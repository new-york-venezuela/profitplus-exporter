# SP: pActualizaCampoLoteAsignado
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pValidarExistenciaLote]
*DESCRIPCIÓN	: Validar existencia del lote en saLote
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-10-08
**************************************************************************/

CREATE PROCEDURE [pActualizaCampoLoteAsignado]
    (
      @sTipo_Documento CHAR(4) ,
      @sLoteAsignado BIT ,
      @gRowguid UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
        IF ( @sTipo_Documento = 'AJUE'
             OR @sTipo_Documento = 'AJUS'
           ) 
            UPDATE
                saAjusteReng
            SET lote_asignado = @sLoteAsignado
            WHERE
                rowguid = @gRowguid
        ELSE 
            IF ( @sTipo_Documento = 'TRAS' ) 
                UPDATE
                    saTrasladoReng
                SET lote_asignado = @sLoteAsignado
                WHERE
                    rowguid = @gRowguid
            ELSE 
                IF ( @sTipo_Documento = 'GCOM' ) 
                    UPDATE
                        saArtCompuestoGenReng
                    SET lote_asignado = @sLoteAsignado
                    WHERE
                        rowguid = @gRowguid
                ELSE 
                    IF ( @sTipo_Documento = 'COMP' ) 
                        UPDATE
                            saFacturaCompraReng
                        SET lote_asignado = @sLoteAsignado
                        WHERE
                            rowguid = @gRowguid
                    ELSE 
                        IF ( @sTipo_Documento = 'NREC' ) 
                            UPDATE
                                saNotaRecepcionCompraReng
                            SET lote_asignado = @sLoteAsignado
                            WHERE
                                rowguid = @gRowguid
                        ELSE 
                            IF ( @sTipo_Documento = 'DCLI' ) 
                                UPDATE
                                    saDevolucionClienteReng
                                SET lote_asignado = @sLoteAsignado
                                WHERE
                                    rowguid = @gRowguid

    END
```
