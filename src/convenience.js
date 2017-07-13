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

/**
 * initTranslations:
 *
 * Initialize Gettext to load translations for metadata['gettext-domain']. If
 * there is no locale subfolder, assume it's in the same prefix as gnome-shell
 */
function initTranslations() {
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
 *
 * Return the GSettings schema for Me.metadata['settings-schema']. If there is
 * no schemas subfolder, assume it's in the same prefix as gnome-shell
 */
function getSettings() {
    let schemaDir = Me.dir.get_child('schemas');
    let schemaSrc;

    if (schemaDir.query_exists(null)) {
        schemaSrc = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir.get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
    } else {
        schemaSrc = Gio.SettingsSchemaSource.get_default();
    }

    return new Gio.Settings({
        settings_schema: schemaSrc.lookup(Me.metadata['gschema-id'], true)
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
    if (getSettings().get_boolean("debug")) {
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
    if (getSettings().get_boolean("debug") && condition !== true) {
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

/**
 * Turns someCrazyName into Some Crazy Name
 * Decent job of acroynyms:
 * ABCAcryonym => ABC Acryoynm
 * xmlHTTPRequest => Xml HTTP Request
 *
 * Credits: https://gist.github.com/mattwiebe/1005915
 */
String.prototype.unCamelCase = function(){
	return this
		// insert a space between lower & upper
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		// space before last upper in a sequence followed by lower
		.replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
		// uppercase the first character
		.replace(/^./, function(str){ return str.toUpperCase(); })
}

