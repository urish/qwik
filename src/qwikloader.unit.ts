import { createDocument } from '@builder.io/qwik/testing';
import type { LoaderWindow } from './qwikloader';
import { qwikLoader } from './qwikloader';

describe('qwikloader', () => {
  let doc: Document;
  let loaderWindow: LoaderWindow;

  beforeEach(() => {
    doc = createDocument();
    loaderWindow = {
      BuildEvents: false,
      BuildWorkerBlob: '',
      qEvents: [],
    };
    (global as any).window = loaderWindow;
  });

  describe('getModuleExport', () => {
    it('should throw error if missing named export', () => {
      expect(() => {
        const loader = qwikLoader(doc);
        const url = new URL('http://qwik.dev/event.js#someExport');
        const module = {};
        loader.getModuleExport(url, module);
      }).toThrowError(`QWIK http://qwik.dev/event.js#someExport does not export someExport`);
    });

    it('should get named export w/ ?', () => {
      const loader = qwikLoader(doc);
      const url = new URL('http://qwik.dev/event.js#someExport?');
      const module = {
        someExport: () => {},
      };
      const handler = loader.getModuleExport(url, module);
      expect(handler).toBe(module.someExport);
    });

    it('should get named export', () => {
      const loader = qwikLoader(doc);
      const url = new URL('http://qwik.dev/event.js#someExport');
      const module = {
        someExport: () => {},
      };
      const handler = loader.getModuleExport(url, module);
      expect(handler).toBe(module.someExport);
    });

    it('should get default export w/  empty hash and ?', () => {
      const loader = qwikLoader(doc);
      const url = new URL('http://qwik.dev/event.js#?');
      const module = {
        default: () => {},
      };
      const handler = loader.getModuleExport(url, module);
      expect(handler).toBe(module.default);
    });

    it('should get default export w/ ?', () => {
      const loader = qwikLoader(doc);
      const url = new URL('http://qwik.dev/event.js?');
      const module = {
        default: () => {},
      };
      const handler = loader.getModuleExport(url, module);
      expect(handler).toBe(module.default);
    });

    it('should get default export w/ empty hash', () => {
      const loader = qwikLoader(doc);
      const url = new URL('http://qwik.dev/event.js#');
      const module = {
        default: () => {},
      };
      const handler = loader.getModuleExport(url, module);
      expect(handler).toBe(module.default);
    });

    it('should get default export, no hash', () => {
      const loader = qwikLoader(doc);
      const url = new URL('http://qwik.dev/event.js');
      const module = {
        default: () => {},
      };
      const handler = loader.getModuleExport(url, module);
      expect(handler).toBe(module.default);
    });

    it('should throw error if missing default export', () => {
      expect(() => {
        const loader = qwikLoader(doc);
        const url = new URL('http://qwik.dev/event.js');
        const module = {};
        loader.getModuleExport(url, module);
      }).toThrowError(`QWIK http://qwik.dev/event.js does not export default`);
    });
  });

  describe('qrlResolver', () => {
    it('should resolve full URL', () => {
      const loader = qwikLoader(doc);
      const div = doc.createElement('div');
      expect(String(loader.qrlResolver(div, 'http://foo.bar/baz'))).toEqual('http://foo.bar/baz');
    });

    it('should resolve relative URL against base', () => {
      const loader = qwikLoader(doc);
      const div = doc.createElement('div');
      const resolvedQrl = loader.qrlResolver(div, './bar');
      expect(resolvedQrl.href).toEqual('http://document.qwik.dev/bar');
    });

    it('should resolve relative URL against q:base', () => {
      const loader = qwikLoader(doc);
      const div = doc.createElement('div');
      div.setAttribute('q:container', '');
      div.setAttribute('q:base', '/baz/');
      const resolvedQrl = loader.qrlResolver(div, './bar');
      expect(resolvedQrl.href).toEqual('http://document.qwik.dev/baz/bar');
    });

    it('should resolve relative URL against nested q:base', () => {
      const loader = qwikLoader(doc);
      const div = doc.createElement('div');
      const parent = doc.createElement('parent');
      doc.body.appendChild(parent);
      parent.appendChild(div);
      parent.setAttribute('q:container', '');
      parent.setAttribute('q:base', './parent/');
      const resolvedQrl = loader.qrlResolver(div, './bar');
      expect(resolvedQrl.href).toEqual('http://document.qwik.dev/parent/bar');
    });
  });

  describe('qrlPrefetch', () => {
    class TestWorker {
      qrls: string[] = [];
      postMessage(qrls: string[]) {
        this.qrls = qrls;
      }
    }

    beforeEach(() => {
      (global as any).Worker = TestWorker;
      (global as any).Blob = class Blob {};
      (URL as any).createObjectURL = () => {};
    });

    it('post prefetch urls to web worker', () => {
      const loader = qwikLoader(doc);
      const div = doc.createElement('div');
      div.setAttribute('q:prefetch', './a.js\n./b.js');

      const parent = doc.createElement('parent');
      parent.setAttribute('q:container', '');
      parent.setAttribute('q:base', './parent/');
      parent.appendChild(div);

      const worker: TestWorker = loader.qrlPrefetch(div);
      expect(worker.qrls).toEqual([
        'http://document.qwik.dev/parent/a.js',
        'http://document.qwik.dev/parent/b.js',
      ]);
    });
  });

  describe('readystate', () => {
    let doc: any;
    beforeEach(() => {
      doc = createReadyStateTestDocument();
      (global as any).CustomEvent = class {};
    });
    afterEach(() => {
      delete (global as any).CustomEvent;
    });

    it('should query on:q-resume document complete', () => {
      doc.readyState = 'complete';
      const spy = jest.spyOn(doc, 'querySelectorAll');
      qwikLoader(doc);
      expect(spy).toHaveBeenCalledWith('[on\\:q-resume]');
    });

    it('should query on:q-resume if document interactive', () => {
      doc.readyState = 'interactive';
      const spy = jest.spyOn(doc, 'querySelectorAll');
      qwikLoader(doc);
      expect(spy).toHaveBeenCalledWith('[on\\:q-resume]');
    });

    it('should not query on:q-resume if document loading', () => {
      doc.readyState = 'loading';
      const spy = jest.spyOn(doc, 'querySelectorAll');
      qwikLoader(doc);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

function createReadyStateTestDocument() {
  const doc = {
    readyState: 'complete',
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return doc;
}
