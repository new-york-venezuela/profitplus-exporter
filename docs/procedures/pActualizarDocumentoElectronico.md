# SP: pActualizarDocumentoElectronico
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:		pActualizarDocumentoElectronico
-- DESCRIPCIÓN: Actualiza los documentos electrónicos
-- AUTOR:		SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarDocumentoElectronico]					  
	(	  
	  @sCo_doc_elec CHAR(20),
	  @sCo_doc_elecOri CHAR(20),
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
      @sCo_us_mo CHAR(6),
      @sCo_sucu_mo CHAR(6),
      @srevisado CHAR(1),
      @strasnfe CHAR(1),
	  @sMaquina VARCHAR(60) = NULL,
	  @sCampos VARCHAR(MAX) = NULL,
	  @tsValidador TIMESTAMP,
	  @gRowguid UNIQUEIDENTIFIER = NULL,
	  @bProcesado BIT,
	  @sLog varchar(max) = NULL,
	  @sTipo_documento CHAR(10),
	  @sTipo_documentoOri CHAR(10)
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

	UPDATE saDocumentoElectronico
	SET		co_doc_elec = @sCo_doc_elec, 
			des_doc_elec = @sDes_doc_elec, 
			fec_doc_elec = @sdFec_doc_elec, 
			co_grupo_rep = @sCo_grupo_rep, 
			co_reporte = @sCo_reporte, 
			sp_doc_elec = @sSp_doc_elec, 
			doc_num_desde = @sDoc_num_desde, 
			doc_num_hasta = @sDoc_num_hasta, 
			fec_emis_desde = @sdFec_emis_desde, 
			fec_emis_hasta = @sdFec_emis_hasta,
```
