# ML Kit's components find each other by class, and its vision libraries ship
# no R8 rules: renamed, a component's dependency is missing (a null
# ExecutorSelector, a NullPointerException on every call).
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }

# ONNX Runtime's native code looks up its Java classes and methods by name.
-keep class ai.onnxruntime.** { *; }
