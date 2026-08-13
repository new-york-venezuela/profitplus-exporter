# SP: pSeleccionarDocumentoCompra
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pSeleccionarDocumentoCompra]
DESCRIPCION: Selecciona un registro de la tabla saDocumentoCompra segun sus claves primarias
CREADO POR: SOFTECH SISTEMAS
FECHA ACTUALIZACION: 2021-04-30
MODIFICADO POR: SOFTECH SISTEMAS (Se busca la fecha del cheque asociada al documento)
***************************************************************************************************************/
Create PROCEDURE [dbo].[pSeleccionarDocumentoCompra]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20)
    )
AS 
    BEGIN
        DECLARE @ExistenRenglones BIT
		
        IF EXISTS ( SELECT
                        a.co_tipo_doc, a.nro_doc
                    FROM
                        saDocumentoCompra e
                        INNER JOIN saDocumentoCompraReng a ON a.nro_doc = e.nro_doc
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
            @ExistenRenglones AS ExistenRenglones, dc.*, CASE WHEN dc.doc_orig = 'PAGO' THEN tp.fecha_che 
			ELSE NULL END AS fecha_che, tp.cod_cta, b.co_ban, b.des_ban, td.tipo_mov,
     	--wosuna Situacion: 104748 se agrego el campo existFacturaReg
			  CAST(( CASE WHEN ( ( SELECT
                                    COUNT(fc.doc_num)
                                 FROM
                                    saFacturaCompra fc
                                 WHERE
                                    fc.doc_num = dc.nro_doc and @sCo_Tipo_Doc = 'FACT'
                               ) > 0 ) THEN 1
                        ELSE 0
                   END ) AS BIT) AS existFacturaReg,
				   NCF.ncf as NumeroControlFiscal, NCF.co_anulacion as co_anulacion, NCF.co_serie AS co_serie, 
			ST.des_tipo_serie AS des_tipo_serie, NCF.tipo_doc_Ori AS tipo_doc_ori, NCF.nro_doc_Ori AS nro_doc_Ori,
			NCF.co_gasto AS co_gasto
        FROM
            saDocumentoCompra dc
            INNER JOIN saTipoDocumento as Td ON td.co_tipo_doc = dc.co_tipo_doc
            LEFT JOIN saPagoTPReng AS tp ON tp.cob_num = dc.nro_orig
```
