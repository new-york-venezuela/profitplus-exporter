# SP: RepGuiaDespacho
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <07-10-10>
-- Description:	<Guia de Despacho>
-- =============================================
CREATE PROCEDURE [dbo].[RepGuiaDespacho]
	-- Add the parameters for the stored procedure here
    @sNum_des_d CHAR(16) = NULL ,
    @sNum_des_h CHAR(16) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

		declare @DirFis as nvarchar(254)
		declare @Telef as nvarchar(254)


		select @DirFis=val_str from saAdiCampo where co_adicampo = 'dir_fis'
		select @Telef=val_str from saAdiCampo where co_adicampo ='telef'

      SELECT

            N.doc_num, NR.co_art, A.modelo, A.art_des, N.comentario, N.co_ven, V.ven_des, N.co_tran,
            t.telefono, T.contacto, T.des_tran, t.colorTransp, T.resp_tra, T.des_tran,
	        
			 -- Función Tipo de Identificador 
            dbo.ObtenerTipoIdentificador(T.tipoIdRespon) + T.ident_responsable AS ident_responsable,
            dbo.ObtenerTipoIdentificador(T2.tipoIdCond) + T2.identificadorCond AS identificadorCond,

			T.tipoIdRespon,
			
			T.identificador_1, T.identificador_2, T.identificador_3, T.resp_tra, N.fec_emis AS fec_emis, dbo.fechasimple(N.fec_venc) AS fec_venc, N.co_mone,
            NR.num_doc AS cli_des2, '' AS co_cli2, F.descrip AS descrip2, N.contrib, N.descrip, C.cli_des, C.fax,
            C.telefonos, C.rif AS rif_ta, C.rif, C.nit AS nit_ta, C.nit, C.direc1,
			(CASE WHEN ( N.dir_ent IS NOT NULL AND len(ltrim( N.dir_ent)) > 0) THEN  N.dir_ent ELSE C.dir_ent2 END) as direc2, 
			NR.total_art, 
            NR.tipo_doc AS tipo_doc, CP.co_cond, CP.cond_des, NR.tipo_doc,
			(select co_uni_peso from par_emp) as co_peso, (select co_uni_volumen from par_emp) as co_volumen,
			A.peso , A.volumen,NR.reng_neto,NR.monto_imp,ISNULL(dbo.ArtUnidadBase(NR.co_art, NR.co_uni, NR.total_art),0) as TotalArtP,
			NR.prec_vta, dbo.ObtenerMonedaBase() as ObtenerMonedaBase,N.fec_venc,CP.cond_des, @DirFis as direccion ,@Telef as TelefonoEmpre, T.clasificacion  AS clasificacion2, N.descrip
			, T2.identificador_1 as identificadorC_1 , T2.identificador_2 as identificadorC_2 ,  T2.identificador_3 as identificadorC_3 , T2.colorTransp colorTranspC,
			T2.nomApelCond, T2.contactoCond, T2.tipoLicCond, T2.identificadorCond, T2.tipoIdCond

        FROM
            saNotaDespach
```
