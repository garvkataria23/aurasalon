import { bootstrapApplication } from "@angular/platform-browser";
import { RouteReuseStrategy, provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideIonicAngular } from "@ionic/angular/standalone";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";
import { authInterceptor } from "./app/core/auth.interceptor";
import { csrfInterceptor } from "./app/core/csrf.interceptor";
import { TabRouteReuseStrategy } from "./app/core/tab-route-reuse.strategy";

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular({ animated: false }),
    provideHttpClient(withInterceptors([csrfInterceptor, authInterceptor])),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: TabRouteReuseStrategy }
  ]
}).catch((error) => console.error(error));
