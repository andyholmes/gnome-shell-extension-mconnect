// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();


// Settings
// FIXME: this is all just crazy
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

function assert(condition, msg) {
    if (!condition) {
        msg = msg || 'Assertion failed'
        debug('Assertion failed: ' + msg);
        throw new Error('Assertion failed: ' + msg)
    };
};

function init() {
    debug('initializing preferences');
    
    // TODO: localization?
};

// Extension Preferences
function buildPrefsWidget() {
    let builder = new Gtk.Builder();
    builder.add_from_file(Me.path + '/prefs.ui');
    
    // Each GSetting key is given an associated widget named 'gsetting-key'
    // and a label named 'gsetting-key-label'. The preferences widget is
    // then programatically built and each option connect to GSettings.
    let optionsList = [
        'per-device-indicators',
        'show-inactive',
        'show-unallowed',
        'show-unpaired',
        'start-daemon',
        'use-kdeconnect',
        'debug'
    ];
    
    let label;
    
    for (let option of optionsList) {
        label = builder.get_object(option + '-label');
        label.set_label(Schema.get_key(option).get_summary());
        Settings.bind(
            option,
            builder.get_object(option),
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    };

    // About
    // TODO: this can all be better
    builder.get_object('extension-name').set_label(Me.metadata.name.toString());
    builder.get_object('extension-description').set_label(Me.metadata.description.toString());
    builder.get_object('extension-url').set_uri(Me.metadata.url.toString());
    //builder.get_object('extension-version').set_label(Me.metadata.version.toString());
    
    //
    let widget = builder.get_object('prefs-widget');
    widget.show_all();
    
    return widget;
};
