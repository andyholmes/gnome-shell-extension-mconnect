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

    let widget = builder.get_object('preferences-notebook');
    
    let settingName;
    let settingLabel;
    
    // Appearance Page
    settingName = 'menu-always';
    settingLabel = builder.get_object(settingName + '-label');
    settingLabel.set_label(Schema.get_key(settingName).get_summary());
    Settings.bind(settingName,
                  builder.get_object(settingName),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);
                  
    settingName = 'per-device-indicators';
    settingLabel = builder.get_object(settingName + '-label');
    settingLabel.set_label(Schema.get_key(settingName).get_summary());
    Settings.bind(settingName,
                  builder.get_object(settingName),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);
                  
    settingName = 'show-inactive';
    settingLabel = builder.get_object(settingName + '-label');
    settingLabel.set_label(Schema.get_key(settingName).get_summary());
    Settings.bind(settingName,
                  builder.get_object(settingName),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);
                  
    settingName = 'show-unallowed';
    settingLabel = builder.get_object(settingName + '-label');
    settingLabel.set_label(Schema.get_key(settingName).get_summary());
    Settings.bind(settingName,
                  builder.get_object(settingName),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);
                  
    settingName = 'show-unpaired';
    settingLabel = builder.get_object(settingName + '-label');
    settingLabel.set_label(Schema.get_key(settingName).get_summary());
    Settings.bind(settingName,
                  builder.get_object(settingName),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);
                  
    // Settings Page
    settingName = 'start-daemon';
    settingLabel = builder.get_object(settingName + '-label');
    settingLabel.set_label(Schema.get_key(settingName).get_summary());
    Settings.bind(settingName,
                  builder.get_object(settingName),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);
                  
    settingName = 'debug';
    settingLabel = builder.get_object(settingName + '-label');
    settingLabel.set_label(Schema.get_key(settingName).get_summary());
    Settings.bind(settingName,
                  builder.get_object(settingName),
                  'active',
                  Gio.SettingsBindFlags.DEFAULT);

    // About Panel
    builder.get_object('extension-name').set_label(Me.metadata.name.toString());
    builder.get_object('extension-description').set_label(Me.metadata.description.toString());
    builder.get_object('extension-url').set_label(Me.metadata.url.toString());
    builder.get_object('extension-version').set_label(Me.metadata.version.toString());
    
    let email = Me.metadata['author-email'].toString()
    let author = Me.metadata['author'].toString() + ' (<a href="mailto:' + email + '">' + email + '</a>)';
    builder.get_object('extension-author').set_label(author);
    
    widget.show_all();
    
    return widget;
};
