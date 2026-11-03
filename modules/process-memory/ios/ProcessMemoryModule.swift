import Darwin
import ExpoModulesCore

public class ProcessMemoryModule: Module {
	public func definition() -> ModuleDefinition {
		Name("ProcessMemory")

		// The memory iOS charges the app, which Jetsam compares to its limit,
		// and how much more it may take before that limit.
		Function("read") { () -> [String: Double]? in
			var info = task_vm_info_data_t()
			var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
			let result = withUnsafeMutablePointer(to: &info) {
				$0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
					task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
				}
			}
			guard result == KERN_SUCCESS else { return nil }
			return [
				"footprint": Double(info.phys_footprint),
				"available": Double(os_proc_available_memory()),
			]
		}
	}
}
