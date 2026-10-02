// lib/pricing/sa-cliente-fields.ts
//
// Full saCliente row as read before any pActualizarCliente call, and the
// write path that changes ONLY tip_cli while passing every other field back
// unchanged.
//
// Verified against the LIVE Ncake_a ERP (not the knowledge-base MCP's
// curated ~25-column "Campos Clave" subset) on 2026-09-27:
//   - INFORMATION_SCHEMA.COLUMNS for saCliente: 76 real columns.
//   - sys.parameters + sp_helptext for pActualizarCliente: 78 parameters.
//   - The SP's own UPDATE...SET clause (read via sp_helptext, not inferred)
//     sets exactly 63 saCliente columns from caller-supplied parameters
//     (plus fe_us_mo = GETDATE(), which the SP sets itself and the caller
//     cannot and must not pass).
//   - Every one of those 63 columns has a matching field in SaClienteRow
//     below and is passed back unchanged in updateCustomerTipCli, except
//     tip_cli which is the one field this feature changes.
//   - saCliente columns the SP's SET clause never touches (numcom, feccom,
//     co_us_in, fe_us_in, co_sucu_in, rowguid) are insert-time/system-only
//     for this SP and are NOT part of the write call -- omitting them from
//     the write cannot blank them, since pActualizarCliente never assigns
//     them regardless of what is or isn't passed as a parameter for them
//     (it doesn't even declare parameters for co_us_in/fe_us_in/rowguid).
//   - pActualizarCliente parameters @sN_cr, @sN_db, @sTComp, @sMaquina have
//     no saCliente column at all -- confirmed via the SP body: they're only
//     forwarded to pInsertarClienteExt (NCF/fiscal-printer integration),
//     gated behind `par_emp.v_maneja_ncf = 1` (confirmed FALSE on this dev
//     instance) -- exactly the kind of "accepted but not persisted to
//     saCliente" parameter the brief flagged (like @sTipo_Iva/@deIva). Safe
//     to pass NULL.
//   - @gRowguid is declared by the SP but never referenced anywhere in its
//     body (not in the UPDATE SET list, not forwarded to any sub-call) --
//     confirmed dead parameter. Safe to pass NULL.
//   - @iId has no saCliente column named "id" in quotes -- it maps to the
//     real column "Id" (capitalized, int, NOT NULL, observed as -1 on every
//     live row sampled). Passed back as read.
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';

// mssql/tedious does not truncate an over-length value passed against a
// fixed-width sql.Char(n) input -- it throws a TDS protocol error at the
// wire level ("Data type 0xAF has an invalid data length or metadata
// length"), confirmed live against this ERP. co_us_mo/co_us_in are
// CHAR(6) columns; session user ids and the fixed 'PROFIT' service-user
// literal are expected to fit, but this guards against any caller (e.g. a
// test harness's own literal) whose value happens to run long.
function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

// Full saCliente row, covering every column pActualizarCliente's SET clause
// assigns from a caller-supplied parameter (63 fields). A missing field
// here would silently blank that column in Profit Plus on the next write.
export interface SaClienteRow {
  coCli: string;
  login: string | null;
  password: string | null;
  salesTax: string | null;
  cliDes: string;
  coSeg: string;
  coZon: string;
  coVen: string;
  estado: string | null;
  inactivo: boolean;
  valido: boolean;
  sinCredito: boolean;
  lunes: boolean;
  martes: boolean;
  miercoles: boolean;
  jueves: boolean;
  viernes: boolean;
  sabado: boolean;
  domingo: boolean;
  direc1: string | null;
  direc2: string | null;
  dirEnt2: string | null;
  horarCaja: string | null;
  frecuVist: string | null;
  telefonos: string | null;
  fax: string | null;
  respons: string | null;
  fechaReg: Date;
  tipCli: string;
  serialp: string | null;
  puntaje: number;
  id: number;
  montCre: number;
  coMone: string | null;
  condPag: string | null;
  plazPag: number;
  descPpago: number;
  descGlob: number;
  rif: string | null;
  contrib: boolean;
  disCen: string | null;
  nit: string | null;
  email: string | null;
  coCtaIngrEgr: string;
  comentario: string | null;
  campo1: string | null;
  campo2: string | null;
  campo3: string | null;
  campo4: string | null;
  campo5: string | null;
  campo6: string | null;
  campo7: string | null;
  campo8: string | null;
  coSucuMo: string | null;
  revisado: string | null;
  trasnfe: string | null;
  juridico: boolean;
  tipoAdi: number;
  matriz: string | null;
  coTab: string | null;
  tipoPer: string | null;
  coPais: string | null;
  ciudad: string | null;
  zip: string | null;
  website: string | null;
  contribuE: boolean;
  reteRegisDoc: boolean;
  porcEsp: number;
  emailAlterno: string | null;
  // Concurrency token -- required by pActualizarCliente's WHERE clause
  // (co_cli = @sCo_CliOri AND validador = @tsValidador). Not part of the
  // SET clause; read fresh and passed back to detect a concurrent edit.
  validador: Buffer;
}

export async function readFullCustomerRow(pool: ConnectionPool, coCli: string): Promise<SaClienteRow | null> {
  const result = await pool.request()
    .input('coCli', sql.Char(16), coCli)
    .query(`SELECT * FROM saCliente WHERE RTRIM(co_cli) = RTRIM(@coCli)`);
  if (result.recordset.length === 0) return null;
  const row = result.recordset[0];
  return {
    coCli: row.co_cli,
    login: row.login,
    password: row.password,
    salesTax: row.salestax,
    cliDes: row.cli_des,
    coSeg: row.co_seg,
    coZon: row.co_zon,
    coVen: row.co_ven,
    estado: row.estado,
    inactivo: Boolean(row.inactivo),
    valido: Boolean(row.valido),
    sinCredito: Boolean(row.sincredito),
    lunes: Boolean(row.lunes),
    martes: Boolean(row.martes),
    miercoles: Boolean(row.miercoles),
    jueves: Boolean(row.jueves),
    viernes: Boolean(row.viernes),
    sabado: Boolean(row.sabado),
    domingo: Boolean(row.domingo),
    direc1: row.direc1,
    direc2: row.direc2,
    dirEnt2: row.dir_ent2,
    horarCaja: row.horar_caja,
    frecuVist: row.frecu_vist,
    telefonos: row.telefonos,
    fax: row.fax,
    respons: row.respons,
    fechaReg: row.fecha_reg,
    tipCli: row.tip_cli,
    serialp: row.serialp,
    puntaje: row.puntaje,
    id: row.Id,
    montCre: row.mont_cre,
    coMone: row.co_mone,
    condPag: row.cond_pag,
    plazPag: row.plaz_pag,
    descPpago: row.desc_ppago,
    descGlob: row.desc_glob,
    rif: row.rif,
    contrib: Boolean(row.contrib),
    disCen: row.dis_cen,
    nit: row.nit,
    email: row.email,
    coCtaIngrEgr: row.co_cta_ingr_egr,
    comentario: row.comentario,
    campo1: row.campo1,
    campo2: row.campo2,
    campo3: row.campo3,
    campo4: row.campo4,
    campo5: row.campo5,
    campo6: row.campo6,
    campo7: row.campo7,
    campo8: row.campo8,
    coSucuMo: row.co_sucu_mo,
    revisado: row.revisado,
    trasnfe: row.trasnfe,
    juridico: Boolean(row.juridico),
    tipoAdi: row.tipo_adi,
    matriz: row.matriz,
    coTab: row.co_tab,
    tipoPer: row.tipo_per,
    coPais: row.co_pais,
    ciudad: row.ciudad,
    zip: row.zip,
    website: row.website,
    contribuE: Boolean(row.contribu_e),
    reteRegisDoc: Boolean(row.rete_regis_doc),
    porcEsp: row.porc_esp,
    emailAlterno: row.email_alterno,
    validador: row.validador,
  };
}

// Applies pActualizarCliente, changing ONLY tip_cli, passing every other
// field back exactly as read. Returns 'conflict' if the SP's own
// validador check found the row already changed (an empty result set --
// NOT a rowcount; confirmed from the SP body: the UPDATE's WHERE clause is
// `co_cli = @sCo_CliOri AND validador = @tsValidador`, and the SP's own
// final SELECT reads back from a table variable populated only via the
// UPDATE's OUTPUT clause, which is empty when the WHERE matched no rows).
export async function updateCustomerTipCli(
  pool: ConnectionPool,
  current: SaClienteRow,
  newTipCli: string,
  modifyingUser: string,
): Promise<'success' | 'conflict'> {
  const req = pool.request();
  req.input('sCo_Cli', sql.Char(16), current.coCli);
  req.input('sCo_CliOri', sql.Char(16), current.coCli); // no rename support in this feature
  req.input('sLogin', sql.Char(10), current.login);
  req.input('sPassword', sql.Char(50), current.password);
  req.input('sSalesTax', sql.Char(8), current.salesTax);
  req.input('sCli_Des', sql.VarChar(100), current.cliDes);
  req.input('sCo_seg', sql.Char(6), current.coSeg);
  req.input('sCo_zon', sql.Char(6), current.coZon);
  req.input('sCo_Ven', sql.Char(6), current.coVen);
  req.input('sEstado', sql.Char(1), current.estado);
  req.input('bInactivo', sql.Bit, current.inactivo);
  req.input('bValido', sql.Bit, current.valido);
  req.input('bSinCredito', sql.Bit, current.sinCredito);
  req.input('bLunes', sql.Bit, current.lunes);
  req.input('bMartes', sql.Bit, current.martes);
  req.input('bMiercoles', sql.Bit, current.miercoles);
  req.input('bJueves', sql.Bit, current.jueves);
  req.input('bViernes', sql.Bit, current.viernes);
  req.input('bSabado', sql.Bit, current.sabado);
  req.input('bDomingo', sql.Bit, current.domingo);
  req.input('sDirec1', sql.VarChar(sql.MAX), current.direc1);
  req.input('sDirec2', sql.VarChar(sql.MAX), current.direc2);
  req.input('sDir_Ent2', sql.VarChar(sql.MAX), current.dirEnt2);
  req.input('sHorar_Caja', sql.VarChar(60), current.horarCaja);
  req.input('sFrecu_Vist', sql.VarChar(60), current.frecuVist);
  req.input('sTelefonos', sql.VarChar(60), current.telefonos);
  req.input('sFax', sql.VarChar(60), current.fax);
  req.input('sRespons', sql.VarChar(60), current.respons);
  req.input('sdFecha_reg', sql.SmallDateTime, current.fechaReg);
  req.input('sTip_Cli', sql.Char(6), newTipCli); // <-- the one changed field
  req.input('sSerialP', sql.Char(30), current.serialp);
  req.input('iPuntaje', sql.Int, current.puntaje);
  req.input('iId', sql.Int, current.id);
  req.input('deMont_cre', sql.Decimal(18, 2), current.montCre);
  req.input('sCo_Mone', sql.Char(6), current.coMone);
  req.input('sCond_Pag', sql.Char(6), current.condPag);
  req.input('iPlaz_pag', sql.Int, current.plazPag);
  req.input('deDesc_ppago', sql.Decimal(18, 2), current.descPpago);
  req.input('deDesc_Glob', sql.Decimal(18, 2), current.descGlob);
  req.input('sRif', sql.VarChar(18), current.rif);
  req.input('bContrib', sql.Bit, current.contrib);
  req.input('sDis_cen', sql.VarChar(sql.MAX), current.disCen);
  req.input('sNit', sql.VarChar(18), current.nit);
  req.input('sEmail', sql.VarChar(60), current.email);
  req.input('sCo_Cta_Ingr_Egr', sql.Char(20), current.coCtaIngrEgr);
  req.input('sComentario', sql.VarChar(sql.MAX), current.comentario);
  req.input('sCampo1', sql.VarChar(60), current.campo1);
  req.input('sCampo2', sql.VarChar(60), current.campo2);
  req.input('sCampo3', sql.VarChar(60), current.campo3);
  req.input('sCampo4', sql.VarChar(60), current.campo4);
  req.input('sCampo5', sql.VarChar(60), current.campo5);
  req.input('sCampo6', sql.VarChar(60), current.campo6);
  req.input('sCampo7', sql.VarChar(60), current.campo7);
  req.input('sCampo8', sql.VarChar(60), current.campo8);
  req.input('sCo_us_mo', sql.Char(6), truncate(modifyingUser, 6));
  req.input('sCo_Sucu_Mo', sql.Char(6), current.coSucuMo);
  req.input('sMaquina', sql.VarChar(60), null); // server-side write; no client "machine" identity to report
  req.input('sCampos', sql.VarChar(sql.MAX), 'tip_cli');
  req.input('sRevisado', sql.Char(1), current.revisado);
  req.input('sTrasnfe', sql.Char(1), current.trasnfe);
  req.input('bJuridico', sql.Bit, current.juridico);
  req.input('iTipo_Adi', sql.Int, current.tipoAdi);
  req.input('sMatriz', sql.Char(16), current.matriz);
  req.input('sCo_Tab', sql.Char(20), current.coTab);
  req.input('sTipo_Per', sql.Char(1), current.tipoPer);
  req.input('sCo_pais', sql.VarChar(6), current.coPais);
  req.input('sCiudad', sql.VarChar(50), current.ciudad);
  req.input('sZip', sql.VarChar(10), current.zip);
  req.input('sWebSite', sql.VarChar(200), current.website);
  req.input('bContribu_E', sql.Bit, current.contribuE);
  req.input('bRete_Regis_Doc', sql.Bit, current.reteRegisDoc);
  req.input('dePorc_Esp', sql.Decimal(18, 2), current.porcEsp);
  req.input('tsValidador', sql.Binary, current.validador);
  req.input('gRowguid', sql.UniqueIdentifier, null); // declared by the SP but never used in its body -- confirmed dead
  req.input('sN_cr', sql.Char(2), null);     // NCF-only, forwarded to pInsertarClienteExt when par_emp.v_maneja_ncf = 1 (FALSE here)
  req.input('sN_db', sql.Char(2), null);     // NCF-only, same as above
  req.input('sTComp', sql.Char(2), null);    // NCF-only, same as above
  req.input('sEmail_alterno', sql.VarChar(120), current.emailAlterno);

  const result = await req.execute('pActualizarCliente');
  return result.recordset && result.recordset.length > 0 ? 'success' : 'conflict';
}

// Finds the saTipoCliente row whose co_precio matches the target price
// list, or creates one via the native pInsertarTipoCliente SP if none
// exists yet (spec Section 4 -- auto-create on first use).
//
// pInsertarTipoCliente's real parameter list (verified via sp_helptext
// against the live ERP) differs from the brief's inferred-from-sibling
// version in three ways:
//   - @sCo_Sucu_In has NO default (`= NULL`) in the SP signature, so it
//     must be passed explicitly -- but the saTipoCliente.co_sucu_in column
//     itself is nullable, and there's no branch/sucursal concept anywhere
//     else in this app's session or config to source a real value from, so
//     NULL is passed explicitly (not omitted).
//   - @sRevisado CHAR(1) and @sTrasnfe CHAR(1) are both required parameters
//     with no default, entirely absent from the brief's version. Existing
//     saTipoCliente rows (both of them, live-inspected) have revisado and
//     trasnfe as NULL, so NULL is passed for both, matching real precedent
//     rather than inventing a flag value.
export async function ensureTipoClienteForPriceList(pool: ConnectionPool, coPrecio: string): Promise<string> {
  // A price list can be mapped by more than one tip_cli (confirmed live:
  // co_precio '01' "CONTADO BS" is mapped by BOTH tip_cli '000001'
  // "INDEPENDIENTE" and '000002' "CADENA"). ORDER BY makes the pick
  // deterministic instead of whatever order SQL Server feels like handing
  // back a plan-dependent TOP 1 with no ORDER BY -- it does not, by itself,
  // avoid the CADENA->INDEPENDIENTE reclassification bug (that's handled in
  // assignCustomerPriceList's no-op check below), but it does mean this
  // function always resolves the same tip_cli for a given co_precio.
  const existing = await pool.request()
    .input('coPrecio', sql.Char(6), coPrecio)
    .query(`SELECT TOP 1 RTRIM(tip_cli) AS tipCli FROM saTipoCliente WHERE RTRIM(co_precio) = RTRIM(@coPrecio) ORDER BY tip_cli`);
  if (existing.recordset.length > 0) return existing.recordset[0].tipCli;

  const priceListResult = await pool.request()
    .input('coPrecio', sql.Char(6), coPrecio)
    .query(`SELECT RTRIM(des_precio) AS desPrecio FROM saTipoPrecio WHERE RTRIM(co_precio) = RTRIM(@coPrecio)`);
  if (priceListResult.recordset.length === 0) {
    throw new Error(`Lista de precio ${coPrecio} no existe`);
  }
  const desPrecio: string = priceListResult.recordset[0].desPrecio;
  const newTipCli = coPrecio; // reuse the price list's own code as the customer-type code, kept legible 1:1 in saTipoCliente

  await pool.request()
    .input('sTip_Cli', sql.Char(6), newTipCli)
    .input('sDes_Tipo', sql.VarChar(60), desPrecio)
    .input('sCo_Precio', sql.Char(6), coPrecio)
    .input('sCo_Us_In', sql.Char(6), 'PROFIT')
    .input('sRevisado', sql.Char(1), null)
    .input('sTrasnfe', sql.Char(1), null)
    .input('sCo_Sucu_In', sql.Char(6), null)
    .execute('pInsertarTipoCliente');

  return newTipCli;
}

export type AssignmentResult =
  | { coCli: string; outcome: 'success' }
  | { coCli: string; outcome: 'conflict' }
  | { coCli: string; outcome: 'error'; message: string };

export async function assignCustomerPriceList(
  pool: ConnectionPool,
  coCli: string,
  targetCoPrecio: string,
  modifyingUser: string,
): Promise<AssignmentResult> {
  try {
    const targetTipCli = await ensureTipoClienteForPriceList(pool, targetCoPrecio);
    const current = await readFullCustomerRow(pool, coCli);
    if (!current) return { coCli, outcome: 'error', message: 'Cliente no encontrado' };

    // No-op guard: when a price list is mapped by more than one tip_cli
    // (confirmed live: co_precio '01' is mapped by both tip_cli '000001'
    // INDEPENDIENTE and '000002' CADENA), ensureTipoClienteForPriceList
    // above always resolves the SAME (deterministic, lowest) tip_cli for a
    // given co_precio -- '000001' for '01'. Without this guard, assigning a
    // customer who is ALREADY correctly on price list '01' under tip_cli
    // '000002' (CADENA) back to price list '01' would silently overwrite
    // their tip_cli to '000001', permanently losing the CADENA
    // classification with no visible UI change (the displayed price list
    // name is unchanged, since both tip_cli codes map to the same
    // co_precio). Guard against this by checking whether the customer's
    // CURRENT tip_cli already maps to the same co_precio as the target
    // (not just whether it equals targetTipCli byte-for-byte) before
    // writing anything.
    if (current.tipCli.trim() === targetTipCli.trim()) {
      return { coCli, outcome: 'success' };
    }
    const currentMapping = await pool.request()
      .input('tipCli', sql.Char(6), current.tipCli)
      .query(`SELECT RTRIM(co_precio) AS coPrecio FROM saTipoCliente WHERE RTRIM(tip_cli) = RTRIM(@tipCli)`);
    const currentCoPrecio: string | undefined = currentMapping.recordset[0]?.coPrecio;
    if (currentCoPrecio !== undefined && currentCoPrecio.trim() === targetCoPrecio.trim()) {
      return { coCli, outcome: 'success' };
    }

    const outcome = await updateCustomerTipCli(pool, current, targetTipCli, modifyingUser);
    return { coCli, outcome };
  } catch (error) {
    console.error(`Pricing assignment error for ${coCli}:`, error);
    return { coCli, outcome: 'error', message: 'Error al actualizar el cliente' };
  }
}

export type SegmentMoveOutcome =
  | { coCli: string; outcome: 'success'; previousTipCli: string }
  | { coCli: string; outcome: 'conflict'; previousTipCli: string }
  | { coCli: string; outcome: 'error'; message: string };

export async function assignCustomerToSegment(
  pool: ConnectionPool, coCli: string, targetTipCli: string, modifyingUser: string,
): Promise<SegmentMoveOutcome> {
  try {
    const current = await readFullCustomerRow(pool, coCli);
    if (!current) return { coCli, outcome: 'error', message: 'Cliente no encontrado' };
    const previousTipCli = current.tipCli.trim();
    if (previousTipCli === targetTipCli.trim()) return { coCli, outcome: 'success', previousTipCli };
    const outcome = await updateCustomerTipCli(pool, current, targetTipCli, modifyingUser);
    return { coCli, outcome, previousTipCli };
  } catch (error) {
    console.error(`Segment move error for ${coCli}:`, error);
    return { coCli, outcome: 'error', message: 'Error al actualizar el cliente' };
  }
}
