/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import * as o from '../output/output_ast';
import {Identifiers as R3} from './r3_identifiers';
import {devOnlyGuardedExpression} from './util';

/** Metadata necessary to compile the HMR initializer call. */
export interface R3HmrInitializerMetadata {
  /** Component class for which HMR is being enabled. */
  type: o.Expression;

  /** Name of the component class. */
  className: string;

  /** File path of the component class. */
  filePath: string;
}

/** Compiles the HMR initializer expression. */
export function compileClassHmrInitializer(meta: R3HmrInitializerMetadata): o.Expression {
  const id = encodeURIComponent(`${meta.filePath}@${meta.className}`);
  const urlPartial = `/@ng/component?c=${id}&t=`;
  const moduleName = 'm';
  const dataName = 'd';

  // ɵɵreplaceMetadata(Comp, m.default);
  const replaceMetadata = o
    .importExpr(R3.replaceMetadata)
    .callFn([meta.type, o.variable(moduleName).prop('default')]);

  // (m) => ɵɵreplaceMetadata(...)
  const replaceCallback = o.arrowFn([new o.FnParam(moduleName)], replaceMetadata);

  // '<urlPartial>' + encodeURIComponent(d.timestamp)
  const urlValue = o
    .literal(urlPartial)
    .plus(o.variable('encodeURIComponent').callFn([o.variable(dataName).prop('timestamp')]));

  // import(/* @vite-ignore */ url).then(() => replaceMetadata(...));
  // The vite-ignore special comment is required to avoid Vite from generating a superfluous
  // warning for each usage within the development code. If Vite provides a method to
  // programmatically avoid this warning in the future, this added comment can be removed here.
  const dynamicImport = new o.DynamicImportExpr(urlValue, null, '@vite-ignore')
    .prop('then')
    .callFn([replaceCallback]);

  // (d) => { if (d.id === <id>) { replaceMetadata(...) } }
  const listenerCallback = o.arrowFn(
    [new o.FnParam(dataName)],
    [o.ifStmt(o.variable(dataName).prop('id').equals(o.literal(id)), [dynamicImport.toStmt()])],
  );

  // import.meta.hot
  const hotRead = o.variable('import').prop('meta').prop('hot');

  // import.meta.hot.on('angular:component-update', () => ...);
  const hotListener = hotRead
    .clone()
    .prop('on')
    .callFn([o.literal('angular:component-update'), listenerCallback]);

  // import.meta.hot && import.meta.hot.on(...)
  return o.arrowFn([], [devOnlyGuardedExpression(hotRead.and(hotListener)).toStmt()]).callFn([]);
}