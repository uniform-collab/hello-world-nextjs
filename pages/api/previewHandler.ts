import {
  IN_CONTEXT_EDITOR_PLAYGROUND_QUERY_STRING_PARAM,
  IN_CONTEXT_EDITOR_QUERY_STRING_PARAM,
  SECRET_QUERY_STRING_PARAM,
} from '@uniformdev/canvas';
import { isAllowedReferrer } from '@uniformdev/canvas';
import type { NextApiHandler, NextApiRequest } from 'next';

export type PreviewData = string | false | object | undefined;

export type UniformPreviewData = PreviewData & {
  isUniformContextualEditing: boolean;
  compositionId?: string;
  compositionSlug?: string;
  compositionPath?: string;
  locale?: string;
  isPlayground?: boolean;
};

const BASE_URL_EXAMPLE = 'https://example.com';

export type ResolveFullPath = (options: {
  /** The ID of the composition */
  id?: string;
  /** The slug of the composition */
  slug?: string;
  /** The path of the project map node attached to the composition, if there is one */
  path?: string;
  /** The preview locale selected in Visual Canvas, available only if Localization is set up */
  locale?: string;
}) => string | undefined;

export type CreatePreviewHandlerGetOptions = {
  secret?: () => string;
  /**
   * Should return the full path to redirect to. Will respond with `400` error if `undefined` is returned.
   * defaults to a function that returns the `path` if truthy, otherwise returns `slug`.
   */
  resolveFullPath?: ResolveFullPath;
  /**
   * The path to the playground page, to live preview components and patterns
   */
  playgroundPath?: string;
};
export type CreatePreviewHandlerGet = (options?: CreatePreviewHandlerGetOptions) => NextApiHandler;

const getQueryParam = (req: NextApiRequest, paramName: string) => {
  const value = req.query[paramName];
  if (typeof value === 'undefined') {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
};

const contextualEditingQueryParams = [
  IN_CONTEXT_EDITOR_QUERY_STRING_PARAM,
  IN_CONTEXT_EDITOR_PLAYGROUND_QUERY_STRING_PARAM,
];

const compositionQueryParam = {
  id: 'id',
  slug: 'slug',
  path: 'path',
  locale: 'locale',
};

export const previewHandler: CreatePreviewHandlerGet =
  ({ secret, resolveFullPath = resolveFullPathDefault, playgroundPath } = {}) =>
  async (req, res) => {
    const isConfigCheck = getQueryParam(req, 'is_config_check') === 'true';

    if (isConfigCheck) {
      res.json({
        hasPlayground: Boolean(playgroundPath),
        isUsingCustomFullPathResolver: resolveFullPath !== resolveFullPathDefault,
      });
      return;
    }
    // If this is a no-cors request (sent by Canvas editor to check if the preview URL is valid), we return immediately.
    if (req.headers['sec-fetch-mode'] === 'no-cors') {
      if (req.query.disable) {
        res.clearPreviewData();
      }

      res.status(204).end();
      return;
    }

    const isPlayground = req.query[IN_CONTEXT_EDITOR_PLAYGROUND_QUERY_STRING_PARAM] === 'true';

    let pathToRedirectTo: undefined | string;

    if (isPlayground && playgroundPath) {
      pathToRedirectTo = playgroundPath;
    }

    const id = getQueryParam(req, compositionQueryParam.id);
    const slug = getQueryParam(req, compositionQueryParam.slug);
    const path = getQueryParam(req, compositionQueryParam.path);
    const locale = getQueryParam(req, compositionQueryParam.locale);

    if (typeof pathToRedirectTo === 'undefined') {
      pathToRedirectTo = resolveFullPath({ id, slug, path, locale });
    }

    validateLocalRedirectUrl(pathToRedirectTo);

    if (!pathToRedirectTo) {
      res.status(400).json({ message: 'Could not resolve the full path of the preview page' });
      return;
    }

    if (req.query.disable) {
      res.clearPreviewData();
      res.redirect(pathToRedirectTo);
      return;
    }

    const previewSecret = typeof secret === 'function' ? secret?.() : secret;
    const isUsingPreviewSecret = Boolean(previewSecret);

    if (isUsingPreviewSecret && req.query[SECRET_QUERY_STRING_PARAM] !== previewSecret) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    const isUniformContextualEditing =
      req.query[IN_CONTEXT_EDITOR_QUERY_STRING_PARAM] === 'true' && isAllowedReferrer(req.headers.referer);

    res.setPreviewData(
      {
        isUniformContextualEditing,
        compositionId: id,
        compositionSlug: slug,
        compositionPath: path,
        locale,
        isPlayground,
      } satisfies UniformPreviewData,
      {
        // By default the preview cookies stays as long as the tab is open. And in contextual editing mode, people tend to open Canvas editor (one tab) and another tab to see published changes.
        // This causes the second tab to still have the preview cookie, which causes unexpected behavior.
        // This is more obvious in contextual editing mode because we skip the composition fetching and the user sees a blank page where they expected the published composition.
        // We set this value to `10` just to handle the case of middlewares and redirections, ideally `0` should do the trick.
        maxAge: isUniformContextualEditing ? 10 : undefined,
      }
    );

    // to bypass cookies security issue when the app is embedded inside an iframe in visual canvas
    // ref: https://github.com/vercel/next.js/discussions/32238#discussioncomment-1766966
    const cookies = res.getHeader('Set-Cookie') as string[];
    res.setHeader('Set-Cookie', cookies?.map(cookie => cookie.replace('SameSite=Lax', 'SameSite=None;Secure')));

    const redirectionUrl = new URL(pathToRedirectTo, BASE_URL_EXAMPLE);
    assignRequestQueryToSearchParams(redirectionUrl.searchParams, req.query);

    // if it is not valid Uniform Contextual Editing - omit the related query params
    if (!isUniformContextualEditing) {
      contextualEditingQueryParams.forEach(param => {
        redirectionUrl.searchParams.delete(param);
      });
    }

    const fullPathToRedirectTo = redirectionUrl.href.replace(BASE_URL_EXAMPLE, '');

    res.redirect(fullPathToRedirectTo);
  };

const resolveFullPathDefault: ResolveFullPath = ({ slug, path }) => {
  return path || slug;
};

function validateLocalRedirectUrl(pathToRedirectTo: string | undefined) {
  // prevent open redirection to any complete URL with a protocol (nnn://whatever)
  if (pathToRedirectTo?.match(/^[a-z]+:\/\//g)) {
    throw new Error('Tried to redirect to absolute URL with protocol. Disallowing open redirect.');
  }
}

const assignRequestQueryToSearchParams = (searchParams: URLSearchParams, query: NextApiRequest['query']) => {
  const compositionQueryParamNames = Object.values(compositionQueryParam);

  Object.entries(query).forEach(([name, value]) => {
    if (name === SECRET_QUERY_STRING_PARAM) {
      return;
    }

    if (compositionQueryParamNames.includes(name)) {
      return;
    }

    if (typeof value === 'undefined') {
      return;
    }

    if (typeof value === 'object') {
      value.forEach(singleValue => searchParams.append(name, singleValue));

      return;
    }

    searchParams.append(name, value);
  });
};
