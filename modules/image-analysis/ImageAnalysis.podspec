Pod::Spec.new do |s|
  s.name           = 'ImageAnalysis'
  s.version        = '1.0.0'
  s.summary        = 'Finds faces, text, subjects, and objects in images with Apple Vision and Segment Anything'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'onnxruntime-objc', '1.30.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "ios/**/*.{h,m,mm,swift,hpp,cpp}"
  # At the module's root, not in ios/, so it can reach the models web shares.
  s.resource_bundles = {
    'MobileSAM' => ['models/mobile_sam_image_encoder.onnx', 'models/sam_mask_decoder_multi.onnx'],
  }
end
