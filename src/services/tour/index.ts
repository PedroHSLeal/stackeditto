import { driver } from "driver.js";

import JsonTour from "@/assets/tour.json";

const driverTour = driver({
  popoverClass: 'tour'
});

export function highlight(element?: Element, title?: string, description?: string) {
  driverTour.highlight({
    element,
    popover: {
      title,
      description
    }
  });
}