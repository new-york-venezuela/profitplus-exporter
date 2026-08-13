# SP: pv_ActualizarDocVentaAsocCobroAnular
**Tipo**: PV-Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
	*NOMBRE			:	[pv_ActualizarDocVentaAsocCobroAnular]
	*DESCRIPCIÓN	:	ACTUALIZA EL ESTADO A ANULADO = TRUE DE LOS DOCUMENTOS ORIGINADOS POR UN COBRO DADO.
	*AUTOR			:	SOFTECH SISTEMAS
	*********************************************************************/
	CREATE PROCEDURE [dbo].[pv_ActualizarDocVentaAsocCobroAnular]
    (
              @sNro_Cobro CHAR(20),
             @sCo_Us_Mo   CHAR(6) ,
             @sCo_Sucu_Mo CHAR(6)                           =      NULL ,
             @sMaquina           VARCHAR(60)                =      NULL ,
             @sCampos            VARCHAR(MAX)        =      NULL ,
             @sRevisado   CHAR(1) ,
             @sTrasnfe           CHAR(1) ,
             @tsValidador TIMESTAMP                  =      NULL ,
             @gRowguid           UNIQUEIDENTIFIER    =      NULL 
       )
AS 
    BEGIN
             SET NOCOUNT ON

             DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

             UPDATE saDocumentoVenta
             SET anulado = 1
                    OUTPUT
                                  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                                  INTO @TableTimestamp
             WHERE DOC_ORIG = 'COBRO' AND NRO_ORIG = @sNro_Cobro

             -- En caso de cobro con N/CR reverso el saldo
             Declare @mont_cob  decimal(18,2)
             Declare @nro_doc  char(20)
             select @mont_cob = isnull(mont_cob,0), @nro_doc= nro_doc from saCobroDocReng where cob_num = @sNro_Cobro and co_tipo_doc = 'N/CR'           
             
             if @mont_cob > 0
             Begin
                    update saDocumentoVenta set saldo = saldo + @mont_cob where nro_doc = @nro_doc and co_tipo_doc = 'N/CR'
             End

             DECLARE @dtFe_In DATETIME
			 DECLARE @rowGuidOri UNIQUEIDENTIFIER

			 SELECT
				@dtFe_In = fe_us_mo, @rowGuidOri = rowguid
			 FROM
				@TableTimestamp

			 IF @dtFe_In IS NOT NULL 
				BEGIN
				 -- Insertar Pista
					EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
						@sTablaOri = 'saDocumentoVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
						@sCam
```
