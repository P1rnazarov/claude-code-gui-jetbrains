package com.github.yhk1038.claudecodegui.toolwindow.realization

/**
 * One-shot guard that allows exactly one successful acquisition.
 *
 * **Not thread-safe** — intended to be called exclusively from the EDT
 * (Event Dispatch Thread). Concurrent access from other threads is undefined behavior.
 */
class RealizationGate {
    private var acquired: Boolean = false

    /**
     * Returns `true` on the very first call and `false` on every subsequent call.
     */
    fun tryAcquire(): Boolean {
        if (acquired) return false
        acquired = true
        return true
    }

    /**
     * Returns `true` if [tryAcquire] has already been called successfully at least once.
     */
    fun isAcquired(): Boolean = acquired
}
