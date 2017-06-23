"use strict";

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.convenience.getSettings();


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
 * UUID of the extension and "[DEBUG]".
 */
function debug(msg) {
    if (Settings.get_boolean("debug")) {
        log("[DEBUG]: " + msg);
    };
}

/**
 * assert:
 * @condition: the condition to assert
 * @msg: the assertion being made
 *
 * Uses Convenience.debug() to print a message to the log and throws Error, if
 * @condition doesn't resolve to 'true'.
 */
function assert(condition, msg) {
    if (Settings.get_boolean("debug") && condition !== true) {
        debug("Assertion failed: " + msg || "unknown");
        throw new Error("Assertion failed: " + msg);
    };
};
								  
