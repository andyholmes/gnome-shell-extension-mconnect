"use strict";

const Gio = imports.gi.Gio;


// Misc utilities
function getPath() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp('@(.+):\\d+').exec((new Error()).stack.split('\n')[1]);
    return Gio.File.new_for_path(m[1]).get_parent().get_path();
}

function getMetadata() {
    // Returns ./metadata.json as an object
    let file = Gio.File.new_for_path(getPath() + '/metadata.json');
    return JSON.parse(file.load_contents(null)[1].toString());
}

// Logging
function debug(msg) {
    if (Settings.get_boolean("debug")) {
        try {
            global.log("[" + getMetadata()["uuid"] + "] DEBUG: " + msg);
        } catch (e if e instanceof ReferenceError) {
            log("[" + getMetadata()["uuid"] + "] DEBUG: " + msg);
        }
    };
}

function assert(condition, msg) {
    if (!condition) {
        msg = msg || 'Assertion failed'
        debug('Assertion failed: ' + msg);
        throw new Error('Assertion failed: ' + msg)
    };
};

// Settings
let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
    getPath(),
    Gio.SettingsSchemaSource.get_default(),
    false
);
const Schema = schemaSource.lookup(getMetadata()["schema-id"], true);
const Settings = new Gio.Settings({ settings_schema: Schema });


