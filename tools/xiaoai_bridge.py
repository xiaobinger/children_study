#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小爱音箱本地桥接服务 (XiaoAI Local Bridge)

作用：让「儿童益智学习乐园」网页 / APP 通过局域网让小爱音箱播报语音。
原理：浏览器直连小米云接口会被 CORS 拦住，本脚本在本机开一个 HTTP 服务，
     底层用 miservice_fork 库登录小米账号并调用小爱 TTS。

一、安装依赖（只需一次）：
    pip install miservice_fork

二、运行（真实模式，需要小米账号）：
    python xiaoai_bridge.py --user 小米账号 --password 密码
    或先设置环境变量再启动：
      PowerShell:  $env:MI_USER="账号"; $env:MI_PASS="密码"
      CMD:         set MI_USER=账号 & set MI_PASS=密码
    python xiaoai_bridge.py

三、运行（演示模式，无需账号，先体验页面功能用）：
    python xiaoai_bridge.py --mock
    （音箱不会真响，播报内容只打印在窗口里）

四、启动后把窗口里提示的「局域网地址」（如 http://192.168.1.5:8899）
    填到 APP：家长中心 → 小爱音箱 → 桥接地址

接口一览（浏览器/调试用）：
    GET /status                         服务状态
    GET /devices                        账号下的小爱音箱列表
    GET /say?text=你好                   默认设备播报
    GET /say?text=你好&device=设备ID     指定设备播报

说明：
  * 首次登录会在用户目录生成 ~/.mi.token 缓存，之后无需重复输密码。
  * 账号密码只留在本机，仅用于登录小米云，不会发给其他任何服务器。
  * 手机 APP 与本脚本需在同一个 WiFi / 局域网内。
"""

import argparse
import asyncio
import json
import os
import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# Windows 控制台中文/emoji 输出
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ARGS = None
_MI_LOCK = threading.Lock()

MOCK_DEVICES = [
    {"deviceID": "mock-speaker-1", "name": "小爱音箱（演示）", "hardware": "MOCK"},
]


def lan_ip():
    """取本机局域网 IP，用于打印给用户填写的地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


# ---------------- 小米接口封装（真实模式） ----------------

def _account_info():
    user = ARGS.user or os.environ.get("MI_USER", "")
    pwd = ARGS.password or os.environ.get("MI_PASS", "")
    return user, pwd


async def _with_mina(fn):
    import aiohttp
    from miservice import MiAccount, MiNAService
    user, pwd = _account_info()
    if not user or not pwd:
        raise RuntimeError("未配置小米账号（--user / --password 或环境变量 MI_USER / MI_PASS）")
    async with aiohttp.ClientSession() as session:
        mina = MiNAService(MiAccount(session, user, pwd))
        return await fn(mina)


def _norm_devices(raw):
    """把 device_list 的返回值统一成 [{deviceID, name, hardware}]"""
    if isinstance(raw, dict):
        raw = raw.get("data") or []
    out = []
    for d in raw or []:
        did = d.get("deviceID") or d.get("deviceId") or ""
        if not did:
            continue
        out.append({
            "deviceID": did,
            "name": d.get("name") or "未命名设备",
            "hardware": d.get("hardware") or "",
        })
    return out


def get_devices():
    if ARGS.mock:
        return list(MOCK_DEVICES)

    async def _list(mina):
        return _norm_devices(await mina.device_list())

    with _MI_LOCK:
        return asyncio.run(_with_mina(_list))


def say(text, device_id=None):
    """让音箱说话；返回 (ok, err)"""
    if ARGS.mock:
        print("  [演示播报] %s" % text)
        return True, None

    async def _say(mina):
        if not hasattr(mina, "text_to_speech"):
            raise RuntimeError("当前 miservice 版本过旧，请升级：pip install -U miservice_fork")
        did = device_id
        if not did:
            devices = _norm_devices(await mina.device_list())
            if not devices:
                raise RuntimeError("账号下没有找到小爱音箱设备")
            did = devices[0]["deviceID"]
        result = await mina.text_to_speech(did, text)
        # miservice 返回 dict，code 为 0 或缺失视为成功
        if isinstance(result, dict) and result.get("code") not in (None, 0):
            raise RuntimeError("小爱返回错误：%s" % json.dumps(result, ensure_ascii=False))
        return True

    try:
        with _MI_LOCK:
            asyncio.run(_with_mina(_say))
        return True, None
    except Exception as e:
        return False, str(e)


# ---------------- HTTP 服务（带 CORS） ----------------

class Handler(BaseHTTPRequestHandler):

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)
        try:
            if path == "/status":
                self._json({"ok": True, "mock": ARGS.mock, "service": "xiaoai-bridge"})
            elif path == "/devices":
                self._json({"ok": True, "mock": ARGS.mock, "devices": get_devices()})
            elif path == "/say":
                text = (qs.get("text") or [""])[0].strip()
                if not text:
                    self._json({"ok": False, "error": "缺少 text 参数"}, 400)
                    return
                device = (qs.get("device") or [""])[0].strip()
                ok, err = say(text, device or None)
                if ok and not ARGS.mock:
                    print("  [播报] %s" % text)
                self._json({"ok": ok, "mock": ARGS.mock, "error": err})
            else:
                self._json({"ok": False, "error": "接口不存在"}, 404)
        except Exception as e:
            self._json({"ok": False, "error": str(e)}, 500)

    def log_message(self, fmt, *args):
        print("[HTTP] " + (fmt % args))


def main():
    global ARGS
    parser = argparse.ArgumentParser(description="小爱音箱本地桥接服务（配合儿童益智学习乐园使用）")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认 0.0.0.0（允许局域网访问）")
    parser.add_argument("--port", type=int, default=8899, help="监听端口，默认 8899")
    parser.add_argument("--user", default="", help="小米账号（也可用环境变量 MI_USER）")
    parser.add_argument("--password", default="", help="小米密码（也可用环境变量 MI_PASS）")
    parser.add_argument("--mock", action="store_true", help="演示模式：不登录小米，播报内容只打印到窗口")
    ARGS = parser.parse_args()

    if not ARGS.mock:
        try:
            import aiohttp  # noqa: F401
            from miservice import MiAccount, MiNAService  # noqa: F401
        except ImportError:
            print("✗ 缺少依赖，请先安装：pip install miservice_fork")
            sys.exit(1)
        user, pwd = _account_info()
        if not user or not pwd:
            print("✗ 未提供小米账号，两种方式任选：")
            print("    1) python xiaoai_bridge.py --user 手机号 --password 密码")
            print("    2) 设置环境变量 MI_USER / MI_PASS 后直接运行")
            print("    （只想先体验功能？加 --mock 用演示模式）")
            sys.exit(1)

    server = ThreadingHTTPServer((ARGS.host, ARGS.port), Handler)
    ip = lan_ip()
    print("=" * 52)
    print("  🔊 小爱音箱桥接服务已启动")
    print("  模式     : " + ("演示（mock）—— 只打印，不真播" if ARGS.mock else "真实（小米账号）"))
    print("  局域网地址: http://%s:%d" % (ip, ARGS.port))
    print("  ↓ 把这个地址填到 APP：家长中心 → 小爱音箱 → 桥接地址")
    print("  停止服务 : 按 Ctrl+C")
    print("=" * 52)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止，再见～")


if __name__ == "__main__":
    main()
