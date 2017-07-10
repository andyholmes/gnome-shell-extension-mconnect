# Source Files:
#   Subsitute any '@VARIABLE@' found in ext_metadata and install the file.
src = [
  # standard files
  'extension.js',
  'stylesheet.css',
  'prefs.js',
  # non-standard files
  'mconnect.js',
  'prefs.ui',
  'share.js',
  'util.js'
]

foreach file : src
  install_data(
    file,
    install_dir: extdatadir,
    install_mode: 'rw-r--r--'
  )
endforeach

if run_command('[', '-d', 'gsxl', ']').returncode() == 0
    subdir('gsxl')
endif

