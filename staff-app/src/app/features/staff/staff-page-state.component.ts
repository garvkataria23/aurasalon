import { Component, input } from "@angular/core";
import { IonSpinner } from "@ionic/angular/standalone";

@Component({
  selector: "section[staffPageState]",
  standalone: true,
  imports: [IonSpinner],
  template: `@if (loading()) { <ion-spinner name="crescent" /> }<ng-content />`
})
export class StaffPageStateComponent {
  readonly loading = input(false);
}
