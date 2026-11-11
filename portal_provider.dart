import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

// Configuration Provider for the Edge Endpoint
final portalEndpointProvider = Provider<String>((ref) => "https://beemax.maxgamesfactoryv3-1.workers.dev");

// Active Processes State Notifier
class PortalProcessNotifier extends StateNotifier<AsyncValue<List<Map<String, dynamic>>>> {
  final Ref ref;

  PortalProcessNotifier(this.ref) : super(const AsyncValue.data([]));

  Future<void> spawnProcess(String pid, Map<String, dynamic> contextData) async {
    final endpoint = ref.read(portalEndpointProvider);
    
    final envelope = {
      "jsonrpc": "2.0",
      "msg_id": "msg_${DateTime.now().millisecondsSinceEpoch}",
      "source_pid": "client_pwa_root",
      "target_pid": "kernel_root",
      "method": "kernel.process.spawn",
      "params": {
        "pid": pid,
        "owner_id": "max_jur",
        "priority": 5,
        "memory_bytes": 1024,
        "context": contextData,
      },
      "timestamp": DateTime.now().millisecondsSinceEpoch,
    };

    try {
      final response = await http.post(
        Uri.parse('$endpoint/api/kernel/ipc'),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(envelope),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        state.whenData((processes) {
          state = AsyncValue.data([...processes, jsonDecode(response.body)]);
        });
      } else {
        throw Exception("IPC Spawn Rejected: ${response.body}");
      }
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> triggerRecovery(String pid) async {
    final endpoint = ref.read(portalEndpointProvider);
    
    try {
      final response = await http.post(
        Uri.parse('$endpoint/api/kernel/recover'),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"pid": pid}),
      );

      if (response.statusCode != 200) {
        throw Exception("Rollback Failed: ${response.body}");
      }
    } catch (e) {
      // Handle recovery error state gracefully
    }
  }
}

final portalProcessProvider = StateNotifierProvider<PortalProcessNotifier, AsyncValue<List<Map<String, dynamic>>>>((ref) {
  return PortalProcessNotifier(ref);
});
