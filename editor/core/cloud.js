export class CloudAdapter {
  constructor(options) {
    options = options || {};
    this.client = options.client || null;
    this.onAuthChange = options.onAuthChange || null;
    this._user = null;
    this._checked = false;
  }

  setClient(client) {
    this.client = client;
  }

  isAvailable() {
    return !!this.client;
  }

  async getActiveUser() {
    if (!this.client) return null;
    try {
      const { data } = await this.client.auth.getSession();
      this._user = data && data.session ? data.session.user : null;
      this._checked = true;
      return this._user;
    } catch (e) {
      this._user = null;
      this._checked = true;
      return null;
    }
  }

  getUser() {
    return this._user;
  }

  isLoggedIn() {
    return !!this._user;
  }

  async loadUserFiles() {
    if (!this.client) return null;
    const user = this._user || (await this.getActiveUser());
    if (!user) return null;
    try {
      const { data, error } = await this.client
        .from("user_documents")
        .select("files, filenames")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("loadUserFiles error:", error.message);
        return null;
      }
      if (!data) return { files: {}, filenames: [] };
      return {
        files: data.files || {},
        filenames: data.filenames || [],
      };
    } catch (e) {
      console.error("loadUserFiles exception:", e);
      return null;
    }
  }

  async saveUserFiles(files, filenames) {
    if (!this.client) return { ok: false, error: "no client" };
    const user = this._user || (await this.getActiveUser());
    if (!user) return { ok: false, error: "not logged in" };
    try {
      const { error } = await this.client
        .from("user_documents")
        .upsert(
          {
            user_id: user.id,
            files: files,
            filenames: filenames,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) {
        console.error("saveUserFiles error:", error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (e) {
      console.error("saveUserFiles exception:", e);
      return { ok: false, error: String(e) };
    }
  }

  async publishGame(config) {
    if (!this.client) return { ok: false, error: "no client" };
    const user = this._user || (await this.getActiveUser());
    const cfg = config || {};
    const slug =
      (cfg.slug || "").trim() ||
      (cfg.title || "game")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30) +
        "-" +
        Math.random().toString(36).slice(2, 6);
    try {
      const row = {
        slug: slug,
        title: cfg.title || "Untitled",
        author_id: user ? user.id : null,
        author_name: user ? user.email || "anonymous" : "anonymous",
        config: cfg.config || {},
        code: cfg.code || "",
        engine_version: cfg.engineVersion || "v4",
        engine_code: cfg.engineCode || "",
        description: cfg.description || null,
      };
      const { data, error } = await this.client
        .from("games")
        .insert([row])
        .select("slug")
        .single();
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true, slug: data.slug };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  async updateGame(slug, config) {
    if (!this.client) return { ok: false, error: "no client" };
    const cfg = config || {};
    try {
      const { error } = await this.client
        .from("games")
        .update({
          code: cfg.code || "",
          config: cfg.config || {},
          engine_version: cfg.engineVersion || "v4",
          engine_code: cfg.engineCode || "",
          description: cfg.description || null,
        })
        .eq("slug", slug);
      if (error) return { ok: false, error: error.message };
      return { ok: true, slug: slug };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  async createSnippet(payload) {
    if (!this.client) return { ok: false, error: "no client" };
    try {
      const { data, error } = await this.client
        .from("snippets")
        .insert([{ code: JSON.stringify(payload) }])
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data.id };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  async loadSnippet(id) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from("snippets")
        .select("code")
        .eq("id", id)
        .single();
      if (error || !data) return null;
      try {
        return JSON.parse(data.code);
      } catch (e) {
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  async loadGameBySlug(slug) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from("games")
        .select("title, description, code, config, engine_version")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  async signInWithOAuth(provider) {
    if (!this.client) return { ok: false, error: "no client" };
    try {
      const { error } = await this.client.auth.signInWithOAuth({
        provider: provider || "github",
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  async signOut() {
    if (!this.client) return;
    try {
      await this.client.auth.signOut();
      this._user = null;
      if (this.onAuthChange) this.onAuthChange(null);
    } catch (e) {}
  }
}