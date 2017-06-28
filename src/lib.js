/*
  Copyright (c) 2011-2012, Giovanni Campagna <scampa.giovanni@gmail.com>
  
  Except where noted, modifications and additional functions are:
  Copyright (c) 2017, Andy Holmes <andrew.g.r.holmes@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the GNOME nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const Gettext = imports.gettext;
const Gio = imports.gi.Gio;

const Config = imports.misc.config;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = getSettings();

/**
 * initTranslations:
 *
 * Initialize Gettext to load translations for metadata['gettext-domain'] from
 * extensionsdir/locale.
 */
function initTranslations() {
    // If the extension doesn't have the locale files in a subfolder, assume
    // that extension has been installed in the same prefix as gnome-shell
    let localeDir = Me.dir.get_child('locale');
    if (localeDir.query_exists(null)) {
        Gettext.bindtextdomain(
            Me.metadata['gettext-domain'],
            localeDir.get_path()
        );
    } else {
        Gettext.bindtextdomain(
            Me.metadata['gettext-domain'],
            Config.LOCALEDIR
        );
    }
}

/**
 * getSettings:
 * @schema: (optional): the GSettings schema id
 *
 * Builds and return a GSettings schema for metadata['settings-schema'], using
 * schema files in extensionsdir/schemas. If @schema is not provided, it is
 * taken from.
 */
function getSettings() {
    const GioSSS = Gio.SettingsSchemaSource;
    let schemaDir = Me.dir.get_child('schemas');
    let schemaSource;

    // If the extension doesn't have the schema files in a subfolder, assume
    // that extension has been installed in the same prefix as gnome-shell
    if (schemaDir.query_exists(null)) {
        schemaSource = GioSSS.new_from_directory(
            schemaDir.get_path(),
            GioSSS.get_default(),
            false
        );
    } else {
        schemaSource = GioSSS.get_default();
    }

    return new Gio.Settings({
        settings_schema: schemaSource.lookup(Me.metadata['gschema-name'], true)
    });
}

/**
 * log:
 * @msg: the message
 *
 * Prints a message to the log, prepended with the UUID of the extension
 */
function log(msg) {
    global.log("[" + Me.metadata.uuid + "]: " + msg);
}

/**
 * debug:
 * @msg: the debugging message
 *
 * Uses Convenience.log() to print a message to the log, prepended with the
 * UUID of the extension and "DEBUG".
 */
function debug(msg) {
    if (Settings.get_boolean("debug")) {
        log("DEBUG: " + msg);
    };
}

/**
 * assert:
 * @condition: the condition to assert
 * @msg: the assertion being made
 *
 * Throws Error with @msg, if @condition doesn't resolve to 'true'.
 */
function assert(condition, msg) {
    if (Settings.get_boolean("debug") && condition !== true) {
        throw new Error("Assertion failed: " + msg);
    };
};

/**
 * String.toCamelCase:
 *
 * The regex will match the first character if it starts with a capital letter,
 * and any alphabetic character following a space, i.e. 2 or 3 times in the
 * specified strings.
 *
 * Credits: https://stackoverflow.com/a/15829686/1108697
 */
String.prototype.toCamelCase = function() {
    return this.replace(/^([A-Z])|\s(\w)/g, function(match, p1, p2, offset) {
        if (p2) return p2.toUpperCase();
        return p1.toLowerCase();        
    });
};

