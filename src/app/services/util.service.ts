import {Injectable} from '@angular/core';
import {AlertController, LoadingController, ToastController} from '@ionic/angular';

@Injectable({providedIn: 'root'})
export class UtilService {
  constructor(
      private readonly alertCtrl: AlertController,
      private readonly loadingCtrl: LoadingController,
      private readonly toastCtrl: ToastController,
  ) {}

  // Copies a string to the clipboard. Must be called from within an
  // event handler such as click. May return false if it failed, but
  // this is not always possible. Browser support for Chrome 43+,
  // Firefox 42+, Safari 10+, Edge and IE 10+.
  // IE: The clipboard feature may be disabled by an administrator. By
  // default a prompt is shown the first time the clipboard is
  // used (per session).
  copyToClipboard(text) {
    if (document.queryCommandSupported &&
        document.queryCommandSupported('copy')) {
      const textarea = document.createElement('textarea');
      textarea.textContent = text;
      // Prevent scrolling to bottom of page in MS Edge.
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        // Security exception may be thrown by some browsers.
        document.execCommand('copy');
        this.showToast('Copied link to clipboard');
      } catch (ex) {
        this.showToast('Copy to clipboard failed');
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  async showToast(message: string, duration: number = 2000) {
    const toast = await this.toastCtrl.create({message, duration});
    toast.present();
  }

  openLink(url: string) {
    window.open(url, '_system', 'location=yes');
  }

  /**
   * Show a confirmation popup, return true if they confirm
   */
  confirm(headerText: string, confirmText: string, cancelText: string):
      Promise<boolean> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header: headerText,
        buttons: [
          {
            text: cancelText,
            role: 'cancel',
            handler: () => {
              resolve(false);
            }
          },
          {
            text: confirmText,
            handler: () => {
              resolve(true);
            }
          }
        ]
      });

      await alert.present();
    });
  }

  /**
   * Present a loader with the given message, then return the loader
   * so the caller can dismiss it with loading.dismiss();
   * @param message
   */
  async presentLoader(message: string) {
    const loading = await this.loadingCtrl.create({message});
    await loading.present();
    return loading;
  }
}
