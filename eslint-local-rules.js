/**
 * ESLint Local Custom Rules
 *
 * プロジェクト固有のコーディング規則を定義するカスタムルール
 */

/**
 * no-useeffect-with-callback-deps
 *
 * useEffectの依存配列にuseCallback/useMemoで定義された関数を含めることを禁止する。
 *
 * 理由: 間接的な依存関係により、不要な再実行が発生する可能性がある。
 *
 * 例:
 * ❌ useEffect(() => {...}, [sessionId, createWebSocket])  // createWebSocketはuseCallback
 * ✅ useEffect(() => {...}, [sessionId])
 */
const noUseEffectWithCallbackDeps = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow useCallback/useMemo in useEffect dependencies',
      recommended: true,
    },
    messages: {
      noDynamicDeps: 'Avoid including {{name}} (created by {{creator}}) in useEffect dependencies. Use only primitive values or refs to prevent unnecessary re-executions.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        // useEffectの呼び出しをチェック
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'useEffect') {
          return;
        }

        // 第2引数（依存配列）を取得
        const depsArray = node.arguments[1];
        if (!depsArray || depsArray.type !== 'ArrayExpression') {
          return;
        }

        // 依存配列の各要素をチェック
        depsArray.elements.forEach((dep) => {
          if (!dep || dep.type !== 'Identifier') {
            return;
          }

          // 変数のスコープから定義を探す
          const scope = context.sourceCode.getScope(dep);
          const variable = scope.variables.find((v) => v.name === dep.name);

          if (!variable || !variable.defs || variable.defs.length === 0) {
            return;
          }

          const def = variable.defs[0];

          // 変数の初期化式をチェック
          if (def.node && def.node.init && def.node.init.type === 'CallExpression') {
            const callee = def.node.init.callee;

            // useCallback または useMemo で定義された変数をチェック
            if (callee.type === 'Identifier' &&
                (callee.name === 'useCallback' || callee.name === 'useMemo')) {
              context.report({
                node: dep,
                messageId: 'noDynamicDeps',
                data: {
                  name: dep.name,
                  creator: callee.name,
                },
              });
            }
          }
        });
      },
    };
  },
};

// ESLint 9 flat config形式のプラグインエクスポート
export default {
  rules: {
    'no-useeffect-with-callback-deps': noUseEffectWithCallbackDeps,
  },
};
