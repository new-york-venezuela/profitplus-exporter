# SP: pActualizarDocumentoImpreso
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)

## Código (excerpt)
```sql
/********************************************************************************
*NOMBRE			: [pActualizarDocumentoImpreso]
*DESCRIPCIÓN	: Marcar el Documento como Impreso
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-08-12
*FECHA ACT      : 2019-06-28
*NOTA			: Actualmente sólo se marca como impresa la Factura de venta
				  sin embargo este SP se creo así por si en futuro es otro mas
********************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarDocumentoImpreso]
    (
      @sDoc_Num CHAR(20) ,
      @sTipoDocumento CHAR(4) , 
	  @sNombreFormato NVARCHAR(MAX) ,
	  @sCo_Us_Mo		CHAR(6) ,
	  @sCo_Sucu_Mo	CHAR(6)				=	NULL , 
	  @sMaquina		VARCHAR(60)			=	NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

			DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

       

        

        IF @sTipoDocumento = 'FACT' 
            BEGIN
              UPDATE saFacturaVenta
								SET impresa = 1
								OUTPUT inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
								INTO @TableTimestamp
								WHERE doc_num = @sDoc_Num

		SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

			IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saFacturaventa', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = '[impresa] = False -> True' , @sAUX02 = @sNombreFormato
            END

            END
	
      IF EXISTS ( SELECT 1 FROM saDocumentoVenta WHERE nro_orig = @sDoc_Num  AND co_tipo_doc = @sTipoDocumento AND co_tipo_doc in('N/CR')AND doc_orig = 'DEVO')
            BEGIN
              UPDATE saDevolucionCliente
								SET impresa = 1
								OUTPUT inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
								INTO @TableTimestamp
								WHERE doc_num = @sDoc_Num

				 SELECT
							@dtFe_In = fe_us_mo, @rowGuidOri = rowguid
						FROM
							@TableTimestamp

							IF @dtFe_In IS NOT NULL 
							BEGIN
							-- Insertar Pista
								EXEC [pI
```
