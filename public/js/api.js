/* ==========================================================================
   api.js —— 后端 REST 接口客户端
   ========================================================================== */
'use strict';

App.api = (function () {
  const base = () => App.config.apiBase;

  class ApiError extends Error {
    constructor(message, status, details) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.details = details;
    }
  }

  async function request(path, options) {
    const opts = options || {};
    const url = `${base()}${path}`;
    const init = {
      method: opts.method || 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }

    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw new ApiError(
        '无法连接后端服务，请确认已运行 npm start（默认 http://127.0.0.1:3000）',
        0
      );
    }

    let payload = null;
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (err) {
        payload = null;
      }
    }

    if (!res.ok) {
      const message =
        (payload && (payload.error || payload.message)) || `请求失败（HTTP ${res.status}）`;
      throw new ApiError(message, res.status, payload && payload.details);
    }
    return payload;
  }

  const qs = (params) => {
    const search = new URLSearchParams();
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === '') return;
      search.set(key, value);
    });
    const str = search.toString();
    return str ? `?${str}` : '';
  };

  return {
    ApiError,
    request,
    health: () => request('/health'),
    meta: () => request('/meta'),
    listPosts: (params) => request(`/posts${qs(params)}`),
    getPost: (id) => request(`/posts/${encodeURIComponent(id)}`),
    createPost: (data) => request('/posts', { method: 'POST', body: data }),
    updatePost: (id, data) => request(`/posts/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
    deletePost: (id) => request(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    listTags: () => request('/tags'),
    stats: () => request('/stats'),
  };
})();
