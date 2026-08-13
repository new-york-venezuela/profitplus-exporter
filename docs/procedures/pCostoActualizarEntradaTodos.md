# SP: pCostoActualizarEntradaTodos
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoActualizarEntradaTodos]
AS 
    BEGIN
        SET NOCOUNT ON ;
       -- DELETE
       --     saCostoHistoricoEntrada
       --WHERE
       --     doc_orig <> '00000000-0000-0000-0000-000000000000'


				-- KC >> Solo elimina del historico articulos activos , para luego reconstruirlos 
        DELETE CHE FROM  
            saCostoHistoricoEntrada CHE 
		INNER JOIN saArticulo ART ON CHE.cod_articulo_rowguid = ART.rowguid and ART.anulado = 0
		WHERE  doc_orig <> '00000000-0000-0000-0000-000000000000' 
		--<< 

        DECLARE @tablaGenerica TABLE
            (
			  IdNum int IDENTITY(1,1),
              RowGuid UNIQUEIDENTIFIER ,
              Tipo_Doc CHAR(4) ,
              fecha_doc DATETIME,
			  fecha_in DATETIME
            )

        INSERT  @tablaGenerica
                ( RowGuid, Tipo_Doc, fecha_doc,fecha_in )
                SELECT
                    R.rowguid, 'AJUS', E.fecha,e.fe_us_in
                FROM
                    saAjusteReng R
                    INNER JOIN saAjuste E ON E.ajue_num = R.ajue_num
                                             AND E.anulado = 0
                    INNER JOIN saTipoAjuste TA ON TA.tipo_trans = '0'
                                                  AND TA.co_tipo = R.co_tipo
					INNER JOIN saArticulo A ON R.co_art = A.co_art AND A.anulado = 0 
                 ORDER BY 3,4,R.reng_num;
        INSERT  @tablaGenerica
                ( RowGuid, Tipo_Doc, fecha_doc,fecha_in )
                SELECT
                    R.rowguid, 'TRAT', E.fec_sal,e.fe_us_in
                FROM
                    saTrasladoReng R
                    INNER JOIN saTraslado E ON E.tras_num = R.tras_num
                                               AND E.anulado = 0
					INNER JOIN saArticulo A ON R.co_art = A.co_art AND A.anulado = 0
				ORDER BY 3,4,R.reng_num;
		-- Ingreso en Almacen Destino
                --UNION
		INSERT  @tablaGenerica
                ( RowGuid, Tipo_Doc, fecha_doc,fecha_in )
                SELECT
                    R.rowguid, 'TRAS', E.fec_conf,e.fe_us_in
                FROM
                    saTrasladoReng R
                    INNER JOIN saTraslado E ON E.tras_num = R.tras_num
                                               AND E.anulado = 0
                                               AND E.confirma = 1
					INNER JOIN saArticulo A ON R.co_art = A.co_art AND A.anulado = 0
				ORDER BY 3,4,R.reng_num;
```
