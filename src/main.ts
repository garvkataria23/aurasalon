import { bootstrapApplication } from '@angular/platform-browser';
import { ErrorHandler } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding, withPreloading } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { csrfInterceptor } from './app/core/csrf.interceptor';
import { GlobalErrorHandler } from './app/core/global-error-handler';
import { httpErrorInterceptor } from './app/core/http-error.interceptor';
import { NavigationPreloadingStrategy } from './app/core/navigation-preloading.strategy';
import { RefreshOnNavigationRouteReuseStrategy } from './app/core/refresh-on-navigation-route-reuse.strategy';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([csrfInterceptor, httpErrorInterceptor])),
    provideRouter(routes, withComponentInputBinding(), withPreloading(NavigationPreloadingStrategy)),
    { provide: RouteReuseStrategy, useClass: RefreshOnNavigationRouteReuseStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
}).catch((error) => console.error(error));
