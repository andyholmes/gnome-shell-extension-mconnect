// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();

// Settings
let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
    Me.dir.get_path(),
    Gio.SettingsSchemaSource.get_default(),
    false
);
const Schema = schemaSource.lookup(Me.metadata['settings-schema'], true);

if (!Schema) {
    schemaSource = Gio.SettingsSchemaSource.get_default();
    const Schema = schemaSource.lookup(Me.metadata['settings-schema'], true);
};

if (!Schema) {
    throw new Error('Could not find schema for ' + Me.metadata['settings-schema']);
};

const Settings = new Gio.Settings({ settings_schema: Schema });

// Logging
function log(msg) {
  global.log('[' + Me.uuid + '] ' + msg);
}

function debug(msg) {
    if (Settings.get_boolean('debug')) {
        log('DEBUG: ' + msg);
    };
}

function init() {
    // Mandatory
};

// Extension Preferences
function buildPrefsWidget() {
    let builder = new Gtk.Builder();
    builder.add_from_file(Me.path + '/prefs.ui');

    let widget = builder.get_object('preferences_notebook');
    
    // Settings panel
    let startDaemonLabel = builder.get_object('start_daemon_label');
    startDaemonLabel.set_label(Schema.get_key('start-daemon').get_summary());
    Settings.bind('start-daemon',
                  builder.get_object('start_daemon'),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);
                  
                  
    let debugLabel = builder.get_object('debug_label');
    debugLabel.set_label(Schema.get_key('debug').get_summary());
    Settings.bind('debug',
                  builder.get_object('debug'),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);

    // About Panel
    builder.get_object('extension_version').set_label(Me.metadata.version.toString());
    
    widget.show_all();
    
    return widget;
};
