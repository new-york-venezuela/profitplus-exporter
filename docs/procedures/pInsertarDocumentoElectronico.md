# SP: pInsertarDocumentoElectronico
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:		pInsertarDocumentoElectronico
-- DESCRIPCIÓN: Inserta los documentos electrónicos
-- AUTOR:		SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pInsertarDocumentoElectronico]
	(
	  @sCo_doc_elec CHAR(20),
	  @sDes_doc_elec VARCHAR(60) = NULL,
	  @sdFec_doc_elec SMALLDATETIME,
	  @sCo_grupo_rep CHAR(6),
	  @sCo_reporte CHAR(6),
	  @sSp_doc_elec CHAR(128) = NULL,
	  @sDoc_num_desde CHAR(20) = NULL,
	  @sDoc_num_hasta CHAR(20) = NULL,
	  @sdFec_emis_desde SMALLDATETIME = NULL,
	  @sdFec_emis_hasta SMALLDATETIME = NULL,
	  @sdFec_venc_desde SMALLDATETIME = NULL,
	  @sdFec_venc_hasta SMALLDATETIME = NULL,
	  @sCo_cli_desde CHAR(16) = NULL,
	  @sCo_cli_hasta CHAR(16) = NULL,
	  @sCo_prov_desde CHAR(16) = NULL,
	  @sCo_prov_hasta CHAR(16) = NULL,
	  @sStatus CHAR(1) = NULL,
	  @iTipo_doc_salida INT = NULL,
	  @bEnviarcorreo BIT,
	  @bMantenerarchivos BIT,
	  @sRuta_arch VARCHAR(1024) = NULL,
	  @sCorreo_asunto VARCHAR(1024) = NULL,
	  @sCorreo_cc VARCHAR(1024) = NULL,
	  @sCorreo_bcc VARCHAR(1024) = NULL,
	  @sCorreo_cuerpo VARCHAR(1024) = NULL,
	  @sCorreo_firma VARCHAR(1024) = NULL,	  
	  @sCampo1 VARCHAR(60) = NULL,
      @sCampo2 VARCHAR(60) = NULL,
      @sCampo3 VARCHAR(60) = NULL,
      @sCampo4 VARCHAR(60) = NULL,
      @sCampo5 VARCHAR(60) = NULL,
      @sCampo6 VARCHAR(60) = NULL,
      @sCampo7 VARCHAR(60) = NULL,
      @sCampo8 VARCHAR(60) = NULL,
      @sCo_us_in CHAR(6),
      @sCo_sucu_in CHAR(6),
      @srevisado CHAR(1),
      @strasnfe CHAR(1),
	  @sMaquina VARCHAR(60) = NULL,
	  @bProcesado BIT,
	  @sLog varchar(max) = NULL,
	  @sTipo_documento CHAR(10)
	)
AS
	BEGIN

		DECLARE @TableTimestamp TABLE
		(
		  validador VARBINARY(MAX),
		  fe_us_in DATETIME,
		  fe_us_mo DATETIME,
		  rowguid UNIQUEIDENTIFIER
		)	

	INSERT INTO saDocumentoElectronico
			(co_doc_elec, des_doc_elec, fec_doc_elec, co_grupo_rep, co_reporte, sp_doc_elec, doc_num_desde, 
			doc_num_hasta, fec_emis_desde, fec_emis_hasta, fec_venc_desde, fec_venc_hasta, co_cli_desde, 
			co_cli_hasta, co_prov_desde, co_prov_hasta, status, tipo_doc_salida, enviarcorreo, mantenerarchivos, 
			ruta_arch, correo_asunto, correo_cc, correo_bcc, correo_cuerpo, correo_firma, campo1, campo2, 
			campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in, fe_us_in, revisado, trasnfe,
			co_us_mo, co_sucu_mo, fe_us_mo, procesa
```
