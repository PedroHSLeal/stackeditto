use std::alloc::{alloc, dealloc, Layout};
static mut OUT_LEN: usize = 0;
#[no_mangle] pub extern "C" fn mdalloc(n: usize) -> *mut u8 { unsafe { alloc(Layout::from_size_align_unchecked(n.max(1), 1)) } }
#[no_mangle] pub extern "C" fn mdfree(p: *mut u8, n: usize) { unsafe { dealloc(p, Layout::from_size_align_unchecked(n.max(1), 1)) } }
#[no_mangle] pub extern "C" fn out_len() -> usize { unsafe { OUT_LEN } }
fn opts() -> markdown::ParseOptions {
    let mut o = markdown::ParseOptions::gfm();
    o.constructs.frontmatter = true;
    o
}
fn ret(s: String) -> *mut u8 {
    let mut b = s.into_bytes().into_boxed_slice();
    unsafe { OUT_LEN = b.len(); }
    let p = b.as_mut_ptr(); std::mem::forget(b); p
}
// returns mdast as JSON
#[no_mangle] pub extern "C" fn to_mdast_json(p: *const u8, n: usize) -> *mut u8 {
    let s = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(p, n)) };
    let ast = markdown::to_mdast(s, &opts()).unwrap();
    ret(serde_json::to_string(&ast).unwrap())
}
// parse only, returns number of top-level children (no serialization)
#[no_mangle] pub extern "C" fn parse_only(p: *const u8, n: usize) -> usize {
    let s = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(p, n)) };
    let ast = markdown::to_mdast(s, &opts()).unwrap();
    ast.children().map(|c| c.len()).unwrap_or(0)
}
#[no_mangle] pub extern "C" fn to_html(p: *const u8, n: usize) -> *mut u8 {
    let s = unsafe { std::str::from_utf8_unchecked(std::slice::from_raw_parts(p, n)) };
    let mut o = markdown::Options::gfm(); o.parse.constructs.frontmatter = true;
    ret(markdown::to_html_with_options(s, &o).unwrap())
}
