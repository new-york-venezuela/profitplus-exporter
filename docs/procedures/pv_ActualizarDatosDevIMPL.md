# SP: pv_ActualizarDatosDevIMPL
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pv_ActualizarDatosDevIMPL
*DESCRIPCIÓN	: Actualiza los datos de impresora fiscal en la devolucion de cliente y documento de venta
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarDatosDevIMPL]
(
   @sDocNum		CHAR(20),
   @sImpfis		CHAR(20),
   @sImpfisfac	CHAR(15),
   @sUltZ		CHAR(15),
   @sCo_Us_Mo	CHAR(6) ,
   @sCo_Sucu_Mo CHAR(6)				=	NULL ,
   @sMaquina	VARCHAR(60)			=	NULL ,
   @sCampos		VARCHAR(MAX)		=	NULL ,
   @sRevisado	CHAR(1) ,
   @sTrasnfe	CHAR(1) ,
   @tsValidador TIMESTAMP			=	NULL ,
   @gRowguid	UNIQUEIDENTIFIER	=	NULL 
)
AS
BEGIN
		DECLARE @TableTimestampdDEVO TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguidDEV UNIQUEIDENTIFIER
            )

		DECLARE @TableTimestampdDOC TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguidDOC UNIQUEIDENTIFIER
            )

		UPDATE saDevolucionCliente SET impfis = @sImpfis , impfisfac = @sImpfisfac ,imp_nro_z = @sUltZ,   campo8 = 1
				OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdDEVO
         WHERE doc_num = @sDocNum
	
		UPDATE saDocumentoVenta SET impfis = @sImpfis , impfisfac = @sImpfisfac ,campo8 = 1, imp_nro_z = @sUltZ
				OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdDOC
        WHERE nro_orig = @sDocNum AND co_tipo_doc = 'N/CR' AND doc_orig = 'DEVO'  

		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOriDEV UNIQUEIDENTIFIER
		DECLARE @rowGuidOriDOC UNIQUEIDENTIFIER

		SELECT
            @dtFe_In = fe_us_mo, @rowGuidOriDEV = rowguidDEV
        FROM
            @TableTimestampdDEVO

		SELECT
            @rowGuidOriDOC = rowguidDOC
        FROM
            @TableTimestampdDOC

        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar PistaS
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saDevolucionCliente', @rowguidOri = @rowGuidOriDEV, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sDocNum
```
