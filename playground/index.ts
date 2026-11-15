let div = document.querySelector("#items");

// @ts-ignore
for (const playground of __PLAYGROUNDS__ as string[]) {
  let anchor = document.createElement("a");

  anchor.href = `/${playground}/`;
  anchor.innerText = playground;

  div!.appendChild(anchor);
}
