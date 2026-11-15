use std::alloc::{alloc, dealloc, Layout};
use std::collections::HashMap;
#[no_mangle] pub extern "C" fn mdalloc(n: usize) -> *mut u8 { unsafe { alloc(Layout::from_size_align_unchecked(n.max(1), 1)) } }
#[no_mangle] pub extern "C" fn mdfree(p: *mut u8, n: usize) { unsafe { dealloc(p, Layout::from_size_align_unchecked(n.max(1), 1)) } }
#[no_mangle] pub extern "C" fn count_matches(p: *const u8, n: usize, q: *const u8, m: usize) -> usize {
    let h = unsafe { std::slice::from_raw_parts(p, n) }; let nd = unsafe { std::slice::from_raw_parts(q, m) };
    memchr::memmem::find_iter(h, nd).count()
}
// ASCII case-insensitive word tokenizer; returns unique words, writes total tokens to *total
#[no_mangle] pub extern "C" fn word_counts(p: *const u8, n: usize) -> usize {
    let h = unsafe { std::slice::from_raw_parts(p, n) };
    let mut map: HashMap<Vec<u8>, u32> = HashMap::new();
    let mut i = 0; let mut buf: Vec<u8> = Vec::with_capacity(64);
    while i <= n {
        let c = if i < n { h[i] } else { b' ' };
        if c.is_ascii_alphanumeric() || c == b'_' { buf.push(c.to_ascii_lowercase()); }
        else if !buf.is_empty() { if let Some(v) = map.get_mut(&buf) { *v += 1 } else { map.insert(buf.clone(), 1); } buf.clear(); }
        i += 1;
    }
    map.len()
}
