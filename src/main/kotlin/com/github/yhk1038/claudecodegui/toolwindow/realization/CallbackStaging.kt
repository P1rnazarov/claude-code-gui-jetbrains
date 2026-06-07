package com.github.yhk1038.claudecodegui.toolwindow.realization

/**
 * Defers a callback until a target (e.g. a BrowserHolder) becomes available.
 *
 * Usage pattern:
 * 1. Call [stage] to record the desired callback value.
 * 2. Call [flush] once the target is ready; if the target has no existing value, the
 *    staged value is applied via the provided setter and `true` is returned.
 *
 * The "don't overwrite existing target" rule in [flush] protects pooled BrowserHolder
 * callbacks during tab move/split — a fresh panel must NOT clobber a holder's existing
 * wiring.
 */
class CallbackStaging<T : Any> {
    private var staged: T? = null

    /**
     * Store the desired callback value. Repeated calls overwrite the previous value.
     */
    fun stage(value: T?) {
        staged = value
    }

    /**
     * Read the currently staged value without consuming it.
     */
    fun current(): T? = staged

    /**
     * Apply the staged value to [set] if and only if [currentTargetValue] is `null` and
     * a staged value exists.
     *
     * @param currentTargetValue the target's current value; if non-null the target already
     *   has a callback and this method does nothing.
     * @param set setter to invoke with the staged value when conditions are met.
     * @return `true` if the staged value was applied, `false` otherwise.
     */
    fun flush(currentTargetValue: T?, set: (T?) -> Unit): Boolean {
        if (currentTargetValue != null) return false
        val value = staged ?: return false
        set(value)
        return true
    }
}
