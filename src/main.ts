import { bootstrapApplication } from '@angular/platform-browser';
import { ErrorHandler } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { GlobalErrorHandler } from './app/core/global-error-handler';
import { RefreshOnNavigationRouteReuseStrategy } from './app/core/refresh-on-navigation-route-reuse.strategy';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: RouteReuseStrategy, useClass: RefreshOnNavigationRouteReuseStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
}).catch((error) => console.error(error));
