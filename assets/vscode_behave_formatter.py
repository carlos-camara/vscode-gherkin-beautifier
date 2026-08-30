import json
import sys
import inspect
import socket
import os
from behave.formatter.base import Formatter

class BehaveCompatibilityAdapter:
    """
    Isolates private Behave API dependencies.
    Provides graceful degradation if upstream Behave changes its internals.
    """
    @staticmethod
    def extract_context_snapshot_safely(formatter_instance):
        try:
            # Locate context via stack introspection
            if getattr(formatter_instance, 'scenario_context', None) is None:
                formatter_instance.scenario_context = BehaveCompatibilityAdapter._get_context_from_stack()
            
            ctx = getattr(formatter_instance, 'scenario_context', None)
            if not ctx:
                return None
            
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

            for k in keys:
                if k.startswith('_') or k in ignore_keys or k.startswith('@'):
                    continue
                v = getattr(ctx, k, None)
                try:
                    snapshot[k] = str(v)
                except Exception:
                    snapshot[k] = "<unserializable>"
            return snapshot if snapshot else None
        except Exception as e:
            # Graceful degradation: snapshot fails but execution tracking continues
            return None

    @staticmethod
    def _get_context_from_stack():
        try:
            for frame_info in inspect.stack():
                frame = frame_info.frame
                if 'runner' in frame.f_locals:
                    runner = frame.f_locals['runner']
                    if hasattr(runner, 'context'):
                        return runner.context
        except Exception:
            pass
        return None

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
        self._emit_core_event("feature", {
            "name": feature.name,
            "filename": feature.filename,
            "line": feature.line
        })

    def scenario(self, scenario):
        if getattr(self, 'current_scenario', None):
            error_msg = getattr(self.current_scenario, "error_message", None)
            if error_msg:
                error_msg = error_msg.strip()
            self._emit_core_event("scenario_result", {
                "line": self.current_scenario.line,
                "status": self.current_scenario.status.name if hasattr(self.current_scenario.status, 'name') else str(self.current_scenario.status),
                "error_message": error_msg,
                "context_snapshot": getattr(self, 'last_context_snapshot', None)
            })
        self.current_scenario = scenario
        self.scenario_context = None
        self.last_context_snapshot = None
        self._emit_core_event("scenario", {
            "name": scenario.name,
            "filename": scenario.filename,
            "line": scenario.line
        })

    def match(self, match):
        if self._step_queue:
            current_step = self._step_queue[0]
            self._emit_core_event("step_start", {
                "name": current_step.name,
                "line": current_step.line
            })

    def result(self, step):
        if self._step_queue:
            self._step_queue.pop(0)

        # Optional Enrichment: Captured safely
        self.last_context_snapshot = BehaveCompatibilityAdapter.extract_context_snapshot_safely(self)

        # Core Execution Tracking
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

        self._emit_core_event("step", data)

    def eof(self):
        if getattr(self, 'current_scenario', None):
            error_msg = getattr(self.current_scenario, "error_message", None)
            if error_msg:
                error_msg = error_msg.strip()
            self._emit_core_event("scenario_result", {
                "line": self.current_scenario.line,
                "status": self.current_scenario.status.name if hasattr(self.current_scenario.status, 'name') else str(self.current_scenario.status),
                "error_message": error_msg,
                "context_snapshot": getattr(self, 'last_context_snapshot', None)
            })
            self.current_scenario = None
        self._emit_core_event("eof", {})
        
        if self._sock:
            try:
                self._sock.close()
            except Exception:
                pass

    def _emit_core_event(self, event, data):
        payload = json.dumps({"version": 1, "type": event, "payload": data})
        if self._sock:
            try:
                self._sock.sendall(f"{payload}\n".encode("utf-8"))
            except Exception as e:
                sys.stderr.write(f"VSCodeFormatter Failed to send event {event}: {e}\n")
        else:
            # Fallback to stdout if no socket is available (e.g. testing)
            sys.stdout.write(f"\n##VSCODE_BEHAVE_EVENT:{json.dumps({'event': event, 'data': data})}\n")
            sys.stdout.flush()
