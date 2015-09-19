// Make setTimeout a lot nicer
export function wait (delay, fn) {
	return setTimeout(fn, delay)
}
