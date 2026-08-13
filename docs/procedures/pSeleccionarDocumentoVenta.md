# SP: pSeleccionarDocumentoVenta
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saChequeDevueltoVenta`](../tables/saChequeDevueltoVenta.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarDocumentoVenta
DESCRIPCION: Selecciona un registro de la tabla saDocumentoVenta segun sus claves primarias
CREADO POR: SOFTECH SISTEMAS
FECHA ACTUALIZACIÓN: 2021-04-30
MODIFICADO POR: SOFTECH SISTEMAS (Se busca la fecha del cheque asociada al documento)
***************************************************************************************************************/
Create PROCEDURE [dbo].[pSeleccionarDocumentoVenta]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20)
    )
AS 
    BEGIN
		
		DECLARE @bChequeManual BIT 
		SET @bChequeManual = 0
			if @sCo_Tipo_Doc = 'CHEQ' 
			BEGIN
				if (SELECT Automatico FROM saChequeDevueltoVenta WHERE nro_doc = @sNro_Doc) = 0
				BEGIN
					SET @bChequeManual = 1
				END
			END

        DECLARE @ExistenRenglones BIT
		
        IF EXISTS ( SELECT
                        a.co_tipo_doc, a.nro_doc
                    FROM
                        saDocumentoVenta e
                        INNER JOIN saDocumentoVentaReng a ON a.nro_doc = e.nro_doc
                                                             AND e.co_tipo_doc = a.co_tipo_doc
                    WHERE
                        e.nro_doc = @sNro_Doc
                        AND e.co_tipo_doc = @sCo_Tipo_Doc ) 
            BEGIN
                SET @ExistenRenglones = 1
            END
        ELSE 
            BEGIN
                SET @ExistenRenglones = 0
            END

        SELECT
            @ExistenRenglones AS ExistenRenglones, dv.*, 
		--wosuna Situacion: 104748 se agrego el campo existFacturaReg
			  CAST(( CASE WHEN ( ( SELECT
                                    COUNT(fc.doc_num)
                                 FROM
                                    saFacturaVenta fc
                                 WHERE
                                    fc.doc_num = dv.nro_doc and @sCo_Tipo_Doc = 'FACT'
                               ) > 0 ) THEN 1
                        ELSE 0
                   END ) AS BIT) AS existFacturaReg,
			CASE @bChequeManual WHEN 1 THEN
				(SELECT saChequeDevueltoVenta.fec_cheq FROM dbo.saChequeDevueltoVenta WHERE saChequeDevueltoVenta.nro_doc = @sNro_Doc) 
			ELSE
				CASE WHEN dv.doc_orig = 'COBRO' THEN tp.fecha_che ELSE NULL END
			END
			AS fecha_che, tp.cod_cta,
			CASE @bChequeManual WHEN 1 THEN
				(
				SELECT saChequeDev
```
