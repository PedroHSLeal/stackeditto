import { driver } from "driver.js";

const driverTour = driver({
  popoverClass: 'tour'
});

export function highlight(element: Element) {
  driverTour.highlight({
    element,
    popover: {
      title: "Title",
      description: "Description"
    }
  });
}