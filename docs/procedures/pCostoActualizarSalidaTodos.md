# SP: pCostoActualizarSalidaTodos
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoActualizarSalidaTodos]
AS 
    BEGIN
        SET NOCOUNT ON ;
		
		--DELETE saCostoHistoricoSalida

		-- KC >> Solo elimina del historico articulos activos , para luego reconstruirlos 
        DELETE CHS FROM  
            saCostoHistoricoSalida CHS 
		INNER JOIN saArticulo ART ON CHS.cod_articulo_rowguid = ART.rowguid AND ART.anulado = 0
		--<< 
		
        --UPDATE
        --    saCostoHistoricoEntrada
        --SET cantidad_usada = 0
	
		-- KC >> 
		UPDATE saCostoHistoricoEntrada
		SET cantidad_usada = 0
		FROM saCostoHistoricoEntrada CHS
		INNER JOIN saArticulo ART ON CHS.cod_articulo_rowguid = ART.rowguid AND ART.anulado = 0
		-- << 


        DECLARE @TipoCosto CHAR(1) 
        SELECT
            @TipoCosto = i_costo_inventario
        FROM
            par_emp

        DECLARE @tablaGenerica TABLE
            (
              IdNum int IDENTITY(1,1),--DN 290925
              RowGuid UNIQUEIDENTIFIER ,
              Tipo_Doc CHAR(4) ,
              fecha_doc DATETIME,
              fecha_in DATETIME --DN 290925
            )

        INSERT  @tablaGenerica
                ( RowGuid, Tipo_Doc, fecha_doc ,fecha_in )
                SELECT
                    R.rowguid, 'AJUS', E.fecha,e.fe_us_in
                FROM
                    saAjusteReng R
                    INNER JOIN saAjuste E ON E.ajue_num = R.ajue_num
                                             AND E.anulado = 0
                    INNER JOIN saTipoAjuste TA ON TA.tipo_trans = '1'
                                                  AND TA.co_tipo = R.co_tipo
					INNER JOIN saArticulo  A ON A.co_Art = R.co_art AND A.anulado = 0 -- KC 
                ORDER BY 3,4,R.reng_num;
        INSERT  @tablaGenerica
                ( RowGuid, Tipo_Doc, fecha_doc ,fecha_in )
			-- Salida Almacen Origen		
                SELECT
                    R.rowguid, 'TRAS', E.fec_sal,e.fe_us_in
                FROM
                    saTrasladoReng R
                    INNER JOIN saTraslado E ON E.tras_num = R.tras_num
                                               AND E.anulado = 0
						INNER JOIN saArticulo A ON A.co_Art = R.co_art AND A.anulado = 0-- KC 
                ORDER BY 3,4,R.reng_num;    
                --UNION
			-- Salida Almacen Temporal
		INSERT  @tablaGenerica
                ( RowGuid, Tipo_Doc, fecha_doc ,fecha_in )
                SELECT
                    R.rowguid, 'TRAT', E.fec_conf,e.
```
