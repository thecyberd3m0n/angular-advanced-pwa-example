import { ApplicationRef, inject, Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BehaviorSubject, concat, first, interval, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Update {
  private readonly updates = inject(SwUpdate);
  private appRef = inject(ApplicationRef);
  private static isNewVersion$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.updates.versionUpdates.subscribe((evt) => {
      switch (evt.type) {
        case 'VERSION_DETECTED':
          console.log(`Downloading new app version: ${evt.version.hash}`);
          break;
        case 'VERSION_READY':
          console.log(`Current app version: ${evt.currentVersion.hash}`);
          console.log(`New app version ready for use: ${evt.latestVersion.hash}`);
          Update.isNewVersion$.next(true);
          break;
        case 'VERSION_INSTALLATION_FAILED':
          console.log(`Failed to install app version '${evt.version.hash}': ${evt.error}`);
          break;
        case 'NO_NEW_VERSION_DETECTED':
          console.log(`No new version detected, current version: ${evt.version.hash}`);
          break;
      }
    });
    // Allow the app to stabilize first, before starting
    // polling for updates with `interval()`.
    const appIsStable$ = this.appRef.isStable.pipe(first((isStable) => isStable === true));
    const everyMinute$ = interval(60 * 1000);
    const everyMinuteOnceAppIsStable$ = concat(appIsStable$, everyMinute$);
    everyMinuteOnceAppIsStable$.subscribe(async () => {
      try {
        const updateFound = await this.updates.checkForUpdate();
        console.log(updateFound ? 'A new version is available.' : 'Already on the latest version.');
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    });
  }

  isNewVersion$() {
    return Update.isNewVersion$;
  }

  activeUpdate() {
    document.location.reload();
  }
}
