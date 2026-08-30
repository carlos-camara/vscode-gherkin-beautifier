import json
import sys
import inspect
import socket
import os
import re
from behave.formatter.base import Formatter

class VSCodeFormatter(Formatter):
    name = "vscode"
    description = "Emits NDJSON events for VS Code Test Explorer over TCP"

    def __init__(self, stream_opener, config):
        super(VSCodeFormatter, self).__init__(stream_opener, config)
        self._step_queue = []
        self._sock = None

        port_str = os.environ.get("VSCODE_BEHAVE_PORT")
        if port_str:
            try:
                port = int(port_str)
                self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self._sock.connect(("127.0.0.1", port))
            except Exception as e:
                sys.stderr.write(f"VSCodeFormatter Failed to connect to port {port_str}: {e}\n")
                self._sock = None

    def step(self, step):
        self._step_queue.append(step)

    def feature(self, feature):
        self._emit("feature", {
            "name": feature.name,
            "filename": feature.filename,
            "line": feature.line
        })

    def scenario(self, scenario):
        if getattr(self, 'current_scenario', None):
            error_msg = getattr(self.current_scenario, "error_message", None)
            if error_msg:
                error_msg = error_msg.strip()
            self._emit("scenario_result", {
                "line": self.current_scenario.line,
                "status": self.current_scenario.status.name if hasattr(self.current_scenario.status, 'name') else str(self.current_scenario.status),
                "error_message": error_msg,
                "context_snapshot": getattr(self, 'last_context_snapshot', None)
            })
        self.current_scenario = scenario
        self.scenario_context = None
        self.last_context_snapshot = None
        self._emit("scenario", {
            "name": scenario.name,
            "filename": scenario.filename,
            "line": scenario.line
        })

    def match(self, match):
        if self._step_queue:
            current_step = self._step_queue[0]
            self._emit("step_start", {
                "name": current_step.name,
                "line": current_step.line
            })

    def result(self, step):
        if self._step_queue:
            self._step_queue.pop(0)

        if not getattr(self, 'scenario_context', None):
            self.scenario_context = self._get_context_from_stack()

        self.last_context_snapshot = self._build_context_snapshot()

        data = {
            "name": step.name,
            "status": step.status.name if hasattr(step.status, 'name') else str(step.status),
            "duration": getattr(step, 'duration', 0)
        }

        if data["status"] in ["failed", "error", "hook_error", "undefined"]:
            if getattr(step, "location", None):
                filename = getattr(step.location, "filename", None)
                if filename:
                    data["error_file"] = os.path.abspath(filename)
                data["error_line"] = getattr(step.location, "line", None)

            error_msg = getattr(step, "error_message", None)
            if error_msg:
                data["error_message"] = f"Step: {step.name}\n{error_msg.strip()}"
            elif data["status"] == "undefined":
                data["error_message"] = f"Step is undefined: {step.name}"

        self._emit("step", data)

    def eof(self):
        if getattr(self, 'current_scenario', None):
            error_msg = getattr(self.current_scenario, "error_message", None)
            if error_msg:
                error_msg = error_msg.strip()
            self._emit("scenario_result", {
                "line": self.current_scenario.line,
                "status": self.current_scenario.status.name if hasattr(self.current_scenario.status, 'name') else str(self.current_scenario.status),
                "error_message": error_msg,
                "context_snapshot": getattr(self, 'last_context_snapshot', None)
            })
            self.current_scenario = None
        self._emit("eof", {})

        if self._sock:
            try:
                self._sock.close()
            except Exception:
                pass

    def _emit(self, event, data):
        payload = json.dumps({"version": 1, "type": event, "payload": data})
        if self._sock:
            try:
                self._sock.sendall(f"{payload}\n".encode("utf-8"))
            except Exception as e:
                sys.stderr.write(f"VSCodeFormatter Failed to send event {event}: {e}\n")

    def _get_context_from_stack(self):
        try:
            for frame_info in inspect.stack():
                frame = frame_info.frame
                if 'runner' in frame.f_locals:
                    runner = frame.f_locals['runner']
                    if hasattr(runner, 'context'):
                        return runner.contex
        except Exception:
            pass
        return None

    def _build_context_snapshot(self):
        try:
            enabled = os.environ.get("VSCODE_BEHAVE_CONTEXT_SNAPSHOT", "true").lower() == "true"
            if not enabled:
                return None

            ctx = getattr(self, 'scenario_context', None)
            if not ctx:
                return None

            allowed_keys_str = os.environ.get("VSCODE_BEHAVE_CONTEXT_ALLOWED_KEYS", "")
            allowed_keys = set([k.strip() for k in allowed_keys_str.split(",") if k.strip()])

            snapshot = {}
            ignore_keys = {'feature', 'scenario', 'tags', 'active_outline', 'aborted', 'failed', 'text', 'table', 'stdout_capture', 'stderr_capture', 'log_capture', 'exc_traceback', 'execute_steps', 'FAIL_ON_CLEANUP_ERRORS', 'LAYER_NAMES', 'config', 'cleanup_errors', 'fail_on_cleanup_errors'}

            keys = set()
            if hasattr(ctx, '_root') and isinstance(ctx._root, dict):
                keys.update(ctx._root.keys())
            if hasattr(ctx, '_origin') and isinstance(ctx._origin, dict):
                keys.update(ctx._origin.keys())
            if hasattr(ctx, '_stack') and isinstance(ctx._stack, list):
                for layer in ctx._stack:
                    if isinstance(layer, dict):
                        keys.update(layer.keys())

            sensitive_key_pattern = re.compile(r'.*(password|secret|token|api_key|apikey|auth|credential|cert|key|session|cookie).*', re.IGNORECASE)
            bearer_pattern = re.compile(r'Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*', re.IGNORECASE)
            aws_pattern = re.compile(r'AKIA[0-9A-Z]{16}')
            url_cred_pattern = re.compile(r'(https?:\/\/)([^:\/\s]+:[^@\/\s]+)@')
            ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

            processed_keys = 0
            MAX_KEYS = 20
            MAX_VAL_LEN = 200

            for k in sorted(list(keys)):
                if processed_keys >= MAX_KEYS:
                    snapshot["_warning"] = "[TRUNCATED: MAX KEYS REACHED]"
                    break

                if k.startswith('_') or k in ignore_keys or k.startswith('@'):
                    continue

                processed_keys += 1
                is_sensitive_key = bool(sensitive_key_pattern.match(k))
                
                # If it's a sensitive key and NOT in the allowed list, redact immediately
                if is_sensitive_key and k not in allowed_keys:
                    snapshot[k] = "[REDACTED]"
                    continue

                v = getattr(ctx, k, None)
                
                try:
                    str_val = str(v)
                except Exception:
                    snapshot[k] = "[UNAVAILABLE: SERIALIZATION ERROR]"
                    continue

                if len(str_val) > MAX_VAL_LEN:
                    str_val = str_val[:MAX_VAL_LEN] + "... [TRUNCATED]"

                # Sanitize ANSI escapes and control characters
                str_val = ansi_escape.sub('', str_val)

                # Value-based redaction
                str_val = bearer_pattern.sub('Bearer [REDACTED]', str_val)
                str_val = aws_pattern.sub('AKIA[REDACTED]', str_val)
                str_val = url_cred_pattern.sub(r'\1[REDACTED]@', str_val)

                snapshot[k] = str_val

            return snapshot if snapshot else None
        except Exception:
            return None
