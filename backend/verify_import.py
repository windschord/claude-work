"""インポート確認スクリプト"""
import sys

try:
    from app.services.process_manager import ProcessManager
    print("SUCCESS: ProcessManager imported successfully")
    print(f"ProcessManager class: {ProcessManager}")
    print(f"Methods: {[m for m in dir(ProcessManager) if not m.startswith('_')]}")
    sys.exit(0)
except Exception as e:
    print(f"ERROR: Failed to import ProcessManager: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
