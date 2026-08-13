# SP: pEliminarProveedor
**Tipo**: Eliminar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarProveedor
*DESCRIPCIÓN	: Elimina un Proveedor
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarProveedor]
    (
      @sCo_ProvOri CHAR(16) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saProveedor
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_prov = @sCo_ProvOri
            AND validador = @tsValidador

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
            
		--Eliminar Imagen Proveedor
		If @dtFe_De IS NOT NULL AND EXISTS (SELECT rowguidDoc from saDocumentoImagen where rowguidDoc = @rowGuidOri)
			BEGIN
				DECLARE @Co_ima CHAR(6)
				DECLARE @Validador_ima TIMESTAMP
				DECLARE @rowguid_ima UNIQUEIDENTIFIER
				DECLARE contador CURSOR LOCAL FORWARD_ONLY
				FOR
					SELECT
						DI.[co_imag], DI.[validador], DI.[rowguid]
					FROM
						saDocumentoImagen AS DI						
					WHERE
						DI.rowguidDoc = @rowGuidOri
					ORDER BY
						DI.Co_imag

					OPEN contador
					FETCH NEXT FROM contador  INTO @Co_ima, @Validador_ima, @rowguid_ima
					WHILE @@FETCH_STATUS = 0
						BEGIN
							EXEC [dbo].[pEliminarDocumentoImagen]	@gRowguidDocOri = @rowGuidOri, @sCo_ImagOri = @Co_ima,
								@tsValidador = @Validador_ima, @sMaquina = @sMaquina, 
								@sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo, 
								@gRowguid = @rowguid_ima
							FETCH NEXT FROM contador INTO @Co_ima, @Validador_ima, @rowguid_ima
						END
					CLOSE contador
					DEALLOCATE contador
			END

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saProveedor', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_ProvOri
```
