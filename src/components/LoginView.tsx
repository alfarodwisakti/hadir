                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-sm transition shadow-[0_18px_35px_rgba(37,99,235,0.45)] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Memproses Masuk...</span>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={handleSupabaseGoogleLogin}
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-100 font-bold py-3 rounded-2xl text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              <Chrome className="w-4 h-4 text-cyan-300" />
              <span>Masuk dengan Google via Supabase</span>
            </button>
          </div>

          <div className="text-center mt-6 text-xs text-slate-400 font-medium tracking-[0.22em] uppercase">
            Presensi Digital Kelas 8.G • SMP Negeri
          </div>
        </div>
      </div>
    </div>
  );
};