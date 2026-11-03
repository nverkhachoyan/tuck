Pod::Spec.new do |s|
  s.name           = 'ProcessMemory'
  s.version        = '1.0.0'
  s.summary        = 'Reads the app process memory footprint, for the dev HUD'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "ios/**/*.swift"
end
